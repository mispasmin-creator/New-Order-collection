/**
 * Standard utility to get the current time in Indian Standard Time (IST)
 * Returns: YYYY-MM-DD HH:MM:SS format
 */
export const getISTTimestamp = () => {
    const now = new Date();
    const offset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + offset);

    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    const hours = String(istDate.getHours()).padStart(2, '0');
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const seconds = String(istDate.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Returns current date in IST: YYYY-MM-DD
 */
export const getISTDate = () => {
    return getISTTimestamp().split(' ')[0];
};

/**
 * Returns current date in IST: DD/MM/YYYY
 */
export const getISTDisplayDate = () => {
    const timestamp = getISTTimestamp();
    const [datePart] = timestamp.split(' ');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
};

/**
 * Returns current date in IST: DD/MM/YYYY HH:MM:SS
 */
export const getISTFullDisplayDateTime = () => {
    const timestamp = getISTTimestamp();
    const [datePart, timePart] = timestamp.split(' ');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year} ${timePart}`;
};
