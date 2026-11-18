import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('desktopEnv', {
    isDesktopApp: true,
    platform: process.platform,
});