export function parseLocalDate(dateString) {
    if (!dateString) return new Date();
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dateString);
}

export function toLocalDateString(dateObj) {
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
}
