const fs = require("fs");
// ========== HELPER FUNCTIONS ==========

/**
 * Convert time string like "6:01:20 am" to total seconds
 */
function timeToSeconds(timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes, seconds] = time.split(':').map(Number);
    
    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return (hours * 3600) + (minutes * 60) + seconds;
}

/**
 * Convert seconds to "hh:mm:ss" format
 */
function secondsToTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // Only pad minutes and seconds (not hours)
    const pad = (num) => num.toString().padStart(2, '0');
    
    // Hours should NOT have leading zero
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Check if date is during Eid period (April 10-30, 2025)
 */
function isEidPeriod(date) {
    const [year, month, day] = date.split('-').map(Number);
    return year === 2025 && month === 4 && day >= 10 && day <= 30;
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
   const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    const durationSeconds = endSeconds - startSeconds;
    return secondsToTime(durationSeconds);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    // Delivery hours: 8 AM (8*3600 sec) to 10 PM (22*3600 sec)
    const DELIVERY_START = 8 * 3600;  // 8 AM in seconds
    const DELIVERY_END = 22 * 3600;   // 10 PM in seconds
    
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    let idleSeconds = 0;
    
    // Add time before 8 AM
    if (startSeconds < DELIVERY_START) {
        idleSeconds += DELIVERY_START - startSeconds;
    }
    
    // Add time after 10 PM
    if (endSeconds > DELIVERY_END) {
        idleSeconds += endSeconds - DELIVERY_END;
    }
    
    return secondsToTime(idleSeconds);
}


// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    // Helper function to parse "hh:mm:ss" format (no AM/PM)
    function timeToSecondsSimple(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return (hours * 3600) + (minutes * 60) + seconds;
    }
    
    // Convert both times to seconds
    const shiftSeconds = timeToSecondsSimple(shiftDuration);
    const idleSeconds = timeToSecondsSimple(idleTime);
    
    // Calculate active time (shift - idle)
    const activeSeconds = shiftSeconds - idleSeconds;
    
    // Convert back to "h:mm:ss" format
    const hours = Math.floor(activeSeconds / 3600);
    const minutes = Math.floor((activeSeconds % 3600) / 60);
    const seconds = activeSeconds % 60;
    
    // Pad minutes and seconds only (hours no padding)
    const pad = (num) => num.toString().padStart(2, '0');
    
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    // Helper to convert "h:mm:ss" to seconds
    function timeToSecondsSimple(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return (hours * 3600) + (minutes * 60) + seconds;
    }
    
    // Parse the date
    const [year, month, day] = date.split('-').map(Number);
    
    // Check if date is during Eid period (April 10-30, 2025)
    const isEid = (year === 2025 && month === 4 && day >= 10 && day <= 30);
    
    // Set quota based on period
    let quotaSeconds;
    if (isEid) {
        quotaSeconds = 6 * 3600; // 6 hours for Eid
    } else {
        quotaSeconds = (8 * 3600) + (24 * 60); // 8 hours 24 minutes for normal days
    }
    
    // Convert activeTime to seconds
    const activeSeconds = timeToSecondsSimple(activeTime);
    
    // Return true if active time meets or exceeds quota
    return activeSeconds >= quotaSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    // Read the file
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.trim().split('\n');
    
    // Extract properties from shiftObj
    const { driverID, driverName, date, startTime, endTime } = shiftObj;
    
    // Check if entry with same driverID and date already exists
    for (let i = 1; i < lines.length; i++) { // Skip header (index 0)
        if (!lines[i].trim()) continue; // Skip empty lines
        
        const columns = lines[i].split(',');
        const existingID = columns[0];
        const existingDate = columns[2];
        
        if (existingID === driverID && existingDate === date) {
            // Duplicate found - return empty object
            return {};
        }
    }
    
    // Calculate all the fields
    const shiftDuration = getShiftDuration(startTime, endTime);
    const idleTime = getIdleTime(startTime, endTime);
    const activeTime = getActiveTime(shiftDuration, idleTime);
    const metQuotaValue = metQuota(date, activeTime);
    
    // Create new record object
    const newRecord = {
        driverID: driverID,
        driverName: driverName,
        date: date,
        startTime: startTime,
        endTime: endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: metQuotaValue,
        hasBonus: false
    };
    
    // Find where to insert the new record
    let insertIndex = lines.length; // Default to end of file
    
    // If driverID exists, insert after their last record
    for (let i = lines.length - 1; i >= 1; i--) { // Start from bottom, skip header
        if (!lines[i].trim()) continue;
        
        const columns = lines[i].split(',');
        const existingID = columns[0];
        
        if (existingID === driverID) {
            insertIndex = i + 1; // Insert after this line
            break;
        }
    }
    
    // Create the new line to insert
    const newLine = `${newRecord.driverID},${newRecord.driverName},${newRecord.date},${newRecord.startTime},${newRecord.endTime},${newRecord.shiftDuration},${newRecord.idleTime},${newRecord.activeTime},${newRecord.metQuota},${newRecord.hasBonus}`;
    
    // Insert the new line at the correct position
    lines.splice(insertIndex, 0, newLine);
    
    // Write back to file
    fs.writeFileSync(textFile, lines.join('\n'));
    
    // Return the new record object
    return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    // Read the file
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.split('\n');
    
    // Loop through each line (skip header at index 0)
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines
        
        const columns = lines[i].split(',');
        const currentID = columns[0];
        const currentDate = columns[2];
        
        // Find the matching record
        if (currentID === driverID && currentDate === date) {
            // Update hasBonus (last column)
            columns[columns.length - 1] = newValue.toString();
            lines[i] = columns.join(',');
            break;
        }
    }
    
    // Write back to file
    fs.writeFileSync(textFile, lines.join('\n'));
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
 // Read the file
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.trim().split('\n');
    
    let count = 0;
    let driverExists = false;
    
    // Convert month to string and normalize
    const monthStr = month.toString();
    const normalizedMonth = monthStr.replace(/^0/, '');
    
    // Loop through each line (skip header at index 0)
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const columns = lines[i].split(',');
        const currentID = columns[0].trim();
        const currentDate = columns[2].trim(); // Format: yyyy-mm-dd
        const hasBonus = columns[columns.length - 1].trim() === 'true';
        
        if (currentID === driverID) {
            driverExists = true;
            
            // Extract month from date (get the month part)
            const dateParts = currentDate.split('-');
            const dateMonth = dateParts[1]; // This is "04" from "2025-04-15"
            const normalizedDateMonth = dateMonth.replace(/^0/, '');
            
            // Check if month matches and has bonus
            if (normalizedDateMonth === normalizedMonth && hasBonus) {
                count++;
            }
        }
    }
    
    return driverExists ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    // Read the file
    const data = fs.readFileSync(textFile, 'utf8');
    const lines = data.trim().split('\n');
    
    let totalSeconds = 0;
    
    // Helper to convert "h:mm:ss" to seconds
    function timeToSecondsSimple(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return (hours * 3600) + (minutes * 60) + seconds;
    }
    
    // Convert month to string for comparison
    const monthStr = month.toString();
    const normalizedMonth = monthStr.replace(/^0/, '');
    
    // Loop through each line (skip header)
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const columns = lines[i].split(',');
        const currentID = columns[0].trim();
        const currentDate = columns[2].trim();
        const activeTime = columns[7].trim(); // activeTime is the 8th column
        
        if (currentID === driverID) {
            // Extract month from date
            const dateParts = currentDate.split('-');
            const dateMonth = dateParts[1].replace(/^0/, '');
            
            if (dateMonth === normalizedMonth) {
                // Add active time to total
                totalSeconds += timeToSecondsSimple(activeTime);
            }
        }
    }
    
    // Convert total seconds to "hhh:mm:ss" format
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // Pad minutes and seconds (hours can be more than 2 digits)
    const pad = (num) => num.toString().padStart(2, '0');
    
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    // TODO: Implement this function
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    // TODO: Implement this function
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
