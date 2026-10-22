import { useSyncExternalStore } from "react";

let isOpen = false;
const listeners = new Set();

function emit() {
    listeners.forEach((listener) => listener());
}

export function openMobileSidebar() {
    if (isOpen) return;
    isOpen = true;
    emit();
}

export function closeMobileSidebar() {
    if (!isOpen) return;
    isOpen = false;
    emit();
}

export function toggleMobileSidebar() {
    isOpen = !isOpen;
    emit();
}

const actions = {
    open: openMobileSidebar,
    close: closeMobileSidebar,
    toggle: toggleMobileSidebar,
};

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return isOpen;
}

function getServerSnapshot() {
    return false;
}

export function useMobileSidebar() {
    return [useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), actions];
}

export default useMobileSidebar;
