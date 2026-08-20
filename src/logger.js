/**
 * Structured, high-visibility console logger for SPC Outlook Dashboard
 */

const BADGES = {
    Boot:     'background: #0ea5e9; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    Map:      'background: #6366f1; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    Theme:    'background: #8b5cf6; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    Radar:    'background: #10b981; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    Alerts:   'background: #ef4444; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    Outlooks: 'background: #f59e0b; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    UI:       'background: #64748b; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    Error:    'background: #dc2626; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;',
    Warn:     'background: #d97706; color: #fff; font-weight: bold; border-radius: 3px; padding: 1px 5px;'
};

export const log = {
    boot:     (msg, ...args) => console.log(`%cSPC:Boot%c ${msg}`, BADGES.Boot, '', ...args),
    map:      (msg, ...args) => console.log(`%cSPC:Map%c ${msg}`, BADGES.Map, '', ...args),
    theme:    (msg, ...args) => console.log(`%cSPC:Theme%c ${msg}`, BADGES.Theme, '', ...args),
    radar:    (msg, ...args) => console.log(`%cSPC:Radar%c ${msg}`, BADGES.Radar, '', ...args),
    alerts:   (msg, ...args) => console.log(`%cSPC:Alerts%c ${msg}`, BADGES.Alerts, '', ...args),
    outlooks: (msg, ...args) => console.log(`%cSPC:Outlooks%c ${msg}`, BADGES.Outlooks, '', ...args),
    ui:       (msg, ...args) => console.log(`%cSPC:UI%c ${msg}`, BADGES.UI, '', ...args),
    warn:     (tag, msg, ...args) => console.warn(`%cSPC:${tag}%c ${msg}`, BADGES.Warn, '', ...args),
    error:    (tag, msg, ...args) => console.error(`%cSPC:${tag}%c ${msg}`, BADGES.Error, '', ...args)
};
