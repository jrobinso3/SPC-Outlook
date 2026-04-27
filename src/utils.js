import { CONFIG } from './config.js';

/**
 * Utility functions for data processing and formatting
 */

export function formatSPCDate(dateStr) {
    if (!dateStr || dateStr.length < 12) return dateStr || 'N/A';
    
    try {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(dateStr.substring(8, 10));
        const minute = parseInt(dateStr.substring(10, 12));
        
        const date = new Date(Date.UTC(year, month, day, hour, minute));
        return date.toLocaleString(undefined, { 
            month: 'short', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit',
            timeZoneName: 'short' 
        });
    } catch (e) {
        return dateStr;
    }
}

export function localizeTimeStrings(text, baseDateStr) {
    if (!baseDateStr || baseDateStr === 'N/A' || baseDateStr.length < 8) return text;
    
    const year = parseInt(baseDateStr.substring(0, 4));
    const month = parseInt(baseDateStr.substring(4, 6)) - 1;
    let defaultDay = parseInt(baseDateStr.substring(6, 8));

    const timeRegex = /\b(\d{2,6})\s?(Z|UTC)\b/g;
    
    return text.replace(timeRegex, (match, digits, tz) => {
        let day = defaultDay;
        let hour, min;
        
        if (digits.length === 6) {
            day = parseInt(digits.substring(0, 2));
            hour = parseInt(digits.substring(2, 4));
            min = parseInt(digits.substring(4, 6));
        } else if (digits.length === 4) {
            hour = parseInt(digits.substring(0, 2));
            min = parseInt(digits.substring(2, 4));
        } else {
            hour = parseInt(digits);
            min = 0;
        }
        
        if (isNaN(hour) || hour > 24) return match;

        const date = new Date(Date.UTC(year, month, day, hour, min));
        const localTime = date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        return `${localTime} (${match})`;
    });
}

export function cleanDiscussionText(text, baseDateStr) {
    if (!text) return "";
    
    let processedText = localizeTimeStrings(text, baseDateStr);

    const lines = processedText.split('\n');
    let paragraphs = [];
    let currentParagraph = [];

    for (let line of lines) {
        const trimmedLine = line.trim();
        
        const isHeader = trimmedLine.startsWith('...') || 
                         (trimmedLine.length > 0 && trimmedLine.length < 50 && trimmedLine === trimmedLine.toUpperCase() && !trimmedLine.includes(' '));
        
        if (isHeader || trimmedLine === '') {
            if (currentParagraph.length > 0) {
                paragraphs.push(currentParagraph.join(' '));
                currentParagraph = [];
            }
            if (trimmedLine !== '') {
                paragraphs.push(trimmedLine);
            }
        } else {
            currentParagraph.push(trimmedLine);
        }
    }
    
    if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
    }
    
    return paragraphs.join('\n\n');
}

export async function fetchGeoJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
}

/**
 * Date and time utilities
 */
export function getDayName(offset) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return dayNames[d.getDay()];
}

export function updateDynamicLabels() {
    const now = new Date();
    CONFIG.layers.forEach(layer => {
        const match = layer.name.match(/Day (\d+)/i);
        if (match) {
            const targetDate = new Date();
            targetDate.setDate(now.getDate() + (parseInt(match[1]) - 1));
            layer.name = layer.name.replace(/Day \d+/i, `${getDayName(parseInt(match[1]) - 1)}'s`);
        }
    });
}

