using ASPCoreWebAPI.Models;
using ASPCoreWebAPI.Repositories;
using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using FcmNotification = FirebaseAdmin.Messaging.Notification;

namespace ASPCoreWebAPI.Services
{
    public interface INotificationService
    {
        Task CreateAndPushAsync(IEnumerable<CreateNotificationDto> notifications);
        Task PushToUsersAsync(IEnumerable<int> userIds, string title, string body, string? link = null);
    }

    public class NotificationService : INotificationService
    {
        private const int MaxTokensPerMulticast = 500;

        private readonly INotificationRepository _repository;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(INotificationRepository repository, ILogger<NotificationService> logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task CreateAndPushAsync(IEnumerable<CreateNotificationDto> notifications)
        {
            var list = notifications.ToList();
            if (list.Count == 0) return;

            await _repository.CreateManyAsync(list);

            foreach (var group in list.GroupBy(n => (n.Title, n.Message, n.Link)))
            {
                await PushToUsersAsync(group.Select(n => n.UserId), group.Key.Title, group.Key.Message, group.Key.Link);
            }
        }

        public async Task PushToUsersAsync(IEnumerable<int> userIds, string title, string body, string? link = null)
        {
            if (FirebaseApp.DefaultInstance == null)
            {
                _logger.LogDebug("Firebase not initialised, skipping push for {Title}", title);
                return;
            }

            try
            {
                var tokens = await _repository.GetFcmTokensByUserIdsAsync(userIds);
                if (tokens.Count == 0) return;

                var invalidTokens = new List<string>();

                foreach (var batch in tokens.Chunk(MaxTokensPerMulticast))
                {
                    var message = new MulticastMessage
                    {
                        Tokens = batch,
                        Notification = new FcmNotification { Title = title, Body = body },
                        Data = new Dictionary<string, string>
                        {
                            ["title"] = title,
                            ["body"] = body,
                            ["link"] = link ?? string.Empty
                        }
                    };

                    var response = await FirebaseMessaging.DefaultInstance.SendEachForMulticastAsync(message);
                    _logger.LogInformation(
                        "Push sent. Title={Title} Success={SuccessCount} Failure={FailureCount}",
                        title, response.SuccessCount, response.FailureCount);

                    invalidTokens.AddRange(GetInvalidTokens(batch.ToList(), response));
                }

                if (invalidTokens.Count > 0)
                {
                    await _repository.RemoveFcmTokensAsync(invalidTokens);
                    _logger.LogInformation("Removed {Count} stale FCM tokens", invalidTokens.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send push notification: {Title}", title);
            }
        }

        private static List<string> GetInvalidTokens(List<string> tokens, BatchResponse response)
        {
            var invalid = new List<string>();

            for (var i = 0; i < response.Responses.Count && i < tokens.Count; i++)
            {
                if (response.Responses[i].Exception is FirebaseMessagingException ex &&
                    (ex.MessagingErrorCode == MessagingErrorCode.Unregistered ||
                     ex.MessagingErrorCode == MessagingErrorCode.InvalidArgument))
                {
                    invalid.Add(tokens[i]);
                }
            }

            return invalid;
        }
    }
}
