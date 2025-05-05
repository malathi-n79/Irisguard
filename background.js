// Constants
const BREAK_INTERVAL = 20; // minutes
const NOTIFICATION_WIDTH = 360;
const NOTIFICATION_HEIGHT = 460;
const SNOOZE_MINUTES = 5;

// State variables
let lastBreakTime = Date.now();
let breakCount = 0;
let totalScreenTime = 0;
let notificationWindowId = null;
let isEnabled = true;
let isBreakActive = false;  // New state to track if a break is currently being displayed

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with default values
  chrome.storage.local.set({
    isEnabled: true,
    breakInterval: BREAK_INTERVAL,
    breakCount: 0,
    totalScreenTime: 0,
    lastBreakTime: Date.now(),
    colorTemp: getDefaultColorTemp(),
    isBreakActive: false // Initialize isBreakActive in storage
  });

  // Set up alarm for tracking screen time
  chrome.alarms.create('screenTimeTracker', { periodInMinutes: 1 });

  // Set up alarm for break reminders
  scheduleNextBreak();
});

// Load state from storage when background script starts
chrome.storage.local.get(
  ['isEnabled', 'breakCount', 'totalScreenTime', 'lastBreakTime', 'isBreakActive'],
  (data) => {
    if (data.isEnabled !== undefined) isEnabled = data.isEnabled;
    if (data.breakCount !== undefined) breakCount = data.breakCount;
    if (data.totalScreenTime !== undefined) totalScreenTime = data.totalScreenTime;
    if (data.lastBreakTime !== undefined) lastBreakTime = data.lastBreakTime;
    if (data.isBreakActive !== undefined) isBreakActive = data.isBreakActive;  // Load isBreakActive
  }
);

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'breakReminder') {
    if (isEnabled && !isBreakActive) {  // Only show notification if enabled and not already on break
      showBreakNotification();
    }
    //IMPORTANT!  DO NOT schedule next break here. scheduleNextBreak is
    //called ONLY when a user completes the break, snoozes the break,
    //or enables the extension.
  } else if (alarm.name === 'screenTimeTracker') {
    // Update screen time counter
    updateScreenTime();
    // Update color temperature based on time of day
    updateColorTemperature();
  }
});

// Schedule the next break
function scheduleNextBreak() {
  chrome.alarms.create('breakReminder', {
    delayInMinutes: BREAK_INTERVAL
  });

  // Update last break time
  lastBreakTime = Date.now();
  chrome.storage.local.set({ lastBreakTime: lastBreakTime });
}

// Show break notification
function showBreakNotification() {
  // Close any existing notification window
  if (notificationWindowId !== null) {
    chrome.windows.remove(notificationWindowId);
    notificationWindowId = null;
  }

  // Get screen dimensions using chrome.system.display API if available
  // or default to fixed values (safer in service worker context)
  chrome.windows.create({
    url: chrome.runtime.getURL('notification.html'),
    type: 'popup',
    width: NOTIFICATION_WIDTH,
    height: NOTIFICATION_HEIGHT,
    left: 100, // Default position - right side of screen
    top: 100,  // Default position - top of screen
    focused: true
  }, (window) => {
    if (window) {
      notificationWindowId = window.id;
    } else {
      console.error("Failed to create notification window");
    }
  });

  // Update break count
  breakCount++;
  chrome.storage.local.set({ breakCount: breakCount });

  // Set isBreakActive to true
  isBreakActive = true;
  chrome.storage.local.set({ isBreakActive: true });
  chrome.alarms.clear('breakReminder'); // Stop the alarm when the break is active
}

// Update screen time counter (called every minute)
function updateScreenTime() {
  totalScreenTime += 1;
  chrome.storage.local.set({ totalScreenTime: totalScreenTime });
}

// Get default color temperature based on time of day
function getDefaultColorTemp() {
  const hour = new Date().getHours();

  // Morning (6am-10am): Cooler light (5500K-6500K)
  if (hour >= 6 && hour < 10) {
    return 6000;
  }
  // Midday (10am-5pm): Neutral light (5000K)
  else if (hour >= 10 && hour < 17) {
    return 5000;
  }
  // Evening (5pm-9pm): Warmer light (3500K-4500K)
  else if (hour >= 17 && hour < 21) {
    return 4000;
  }
  // Night (9pm-6am): Very warm light (2700K-3000K)
  else {
    return 2700;
  }
}

// Update color temperature based on time of day
function updateColorTemperature() {
  const colorTemp = getDefaultColorTemp();
  chrome.storage.local.set({ colorTemp: colorTemp });
}

// Calculate time until next break in minutes and seconds
function calculateNextBreakTime(lastBreakTimestamp) {
  // Make sure lastBreakTimestamp is a valid number
  if (!lastBreakTimestamp || isNaN(lastBreakTimestamp)) {
    lastBreakTimestamp = Date.now();
  }

  const elapsedMs = Date.now() - lastBreakTimestamp;
  const elapsedSeconds = elapsedMs / 1000;
  const remainingSeconds = Math.max(0, BREAK_INTERVAL * 60 - elapsedSeconds);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = Math.floor(remainingSeconds % 60);

  return {
    minutes: minutes,
    seconds: seconds,
    totalSeconds: Math.round(remainingSeconds)
  };
}

// Listen for messages from popup or notification
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startBreak') {
    try {
      // Increment break count when manually taking a break
      breakCount++;
      chrome.storage.local.set({ breakCount: breakCount });

      // Handle start break action
      // scheduleNextBreak();   // Do NOT schedule next break here, it is called from the notification
      if (notificationWindowId !== null) {
        chrome.windows.remove(notificationWindowId);
        notificationWindowId = null;
      }
      isBreakActive = false; // Break is complete
      chrome.storage.local.set({ isBreakActive: false });
      scheduleNextBreak();   //Schedule next break
      // Important: Send response immediately
      sendResponse({ success: true, breakCount: breakCount });
    } catch (error) {
      console.error("Error in startBreak handler:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  }
  else if (message.action === 'snoozeBreak') {
    try {
      // Snooze for 5 minutes
      chrome.alarms.create('breakReminder', {
        delayInMinutes: SNOOZE_MINUTES
      });

      if (notificationWindowId !== null) {
        chrome.windows.remove(notificationWindowId);
        notificationWindowId = null;
      }
      isBreakActive = false; // Break is complete
      chrome.storage.local.set({ isBreakActive: false });
      scheduleNextBreak();   //Schedule next break
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error in snoozeBreak handler:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  }
  else if (message.action === 'getStats') {
    try {
      // Get data from storage
      chrome.storage.local.get(['isEnabled', 'breakCount', 'totalScreenTime', 'lastBreakTime', 'colorTemp', 'isBreakActive'], (data) => {
        try {
          // Use storage values with fallbacks to memory variables
          const localIsEnabled = data.isEnabled !== undefined ? data.isEnabled : isEnabled;
          const localBreakCount = data.breakCount !== undefined ? data.breakCount : breakCount;
          const localTotalScreenTime = data.totalScreenTime !== undefined ? data.totalScreenTime : totalScreenTime;
          const localLastBreakTime = data.lastBreakTime !== undefined ? data.lastBreakTime : lastBreakTime;
          const localColorTemp = data.colorTemp || getDefaultColorTemp();
          const localIsBreakActive = data.isBreakActive !== undefined ? data.isBreakActive : isBreakActive; //Get isBreakActive

          // Calculate next break time, but only if the extension is enabled
          const nextBreakTime = localIsEnabled && !localIsBreakActive ?
            calculateNextBreakTime(localLastBreakTime) :
            { minutes: BREAK_INTERVAL, seconds: 0 };

          // Send response with all stats
          sendResponse({
            isEnabled: localIsEnabled,
            breakCount: localBreakCount,
            totalScreenTime: localTotalScreenTime,
            lastBreakTime: localLastBreakTime,
            colorTemp: localColorTemp,
            nextBreakIn: nextBreakTime,
            isBreakActive: localIsBreakActive  // Send isBreakActive status
          });
        } catch (innerError) {
          console.error("Error processing stats:", innerError);
          sendResponse({
            error: innerError.message,
            isEnabled: isEnabled,
            breakCount: breakCount,
            totalScreenTime: totalScreenTime,
            lastBreakTime: lastBreakTime,
            colorTemp: getDefaultColorTemp(),
            nextBreakIn: { minutes: BREAK_INTERVAL, seconds: 0 },
            isBreakActive: isBreakActive //Send isBreakActive
          });
        }
      });
    } catch (error) {
      console.error("Error in getStats handler:", error);
      sendResponse({
        error: error.message,
        isEnabled: isEnabled,
        breakCount: breakCount,
        totalScreenTime: totalScreenTime,
        nextBreakIn: { minutes: BREAK_INTERVAL, seconds: 0 },
        isBreakActive: isBreakActive //Send isBreakActive
      });
    }
    return true; // Keep message channel open for async response
  }
  else if (message.action === 'toggleEnabled') {
    try {
      isEnabled = message.isEnabled;
      chrome.storage.local.set({ isEnabled: isEnabled });

      // If toggling on/off, handle the timer accordingly
      if (isEnabled) {
        // Restart the break timer when enabling
        scheduleNextBreak();
      } else {
        // Clear the existing alarm when disabling
        chrome.alarms.clear('breakReminder');
      }

      sendResponse({
        success: true,
        isEnabled: isEnabled,
        // If disabled, send back the default time
        nextBreakIn: isEnabled ? calculateNextBreakTime(lastBreakTime) : { minutes: BREAK_INTERVAL, seconds: 0 }
      });
    } catch (error) {
      console.error("Error in toggleEnabled handler:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  }

  return true; // Keep message channel open for async response
});