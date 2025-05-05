document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const enableToggle = document.getElementById('enableToggle');
  const nextBreakTimer = document.getElementById('nextBreakTimer');
  const screenTimeValue = document.getElementById('screenTimeValue');
  const colorTempValue = document.getElementById('colorTempValue');
  const breaksValue = document.getElementById('breaksValue');
  const startBreakNowButton = document.getElementById('startBreakNow');

  // Initialize UI
  refreshStats();

  // Set up timer to refresh stats every second
  setInterval(refreshStats, 1000);

  // Listen for toggle changes
  enableToggle.addEventListener('change', function() {
    // Update UI immediately to be more responsive
    const isEnabled = enableToggle.checked;

    chrome.runtime.sendMessage({
      action: 'toggleEnabled',
      isEnabled: isEnabled
    }, function(response) {
      // Update the timer immediately with the response
      if (response && response.success && response.nextBreakIn) {
        const minutes = response.nextBreakIn.minutes || 0;
        const seconds = response.nextBreakIn.seconds || 0;
        nextBreakTimer.textContent = `${padZero(minutes)}:${padZero(seconds)}`;
      } else if (response && !response.success) {
        console.error("Error toggling enabled state:", response.error);
      }
    });
  });

  // Listen for "Take a break now" button click
  startBreakNowButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'startBreak' }, function(response) {
      if (response && response.success) {
        // Update the break count immediately before closing popup
        if (breaksValue && response.breakCount) {
          breaksValue.textContent = response.breakCount;
        }
        // Close popup after successful response
        window.close();
      } else if (response && !response.success) {
        console.error("Error starting break:", response.error);
      }
    });
  });

  // Function to refresh stats
  function refreshStats() {
    try {
      chrome.runtime.sendMessage({ action: 'getStats' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error("Error getting stats:", chrome.runtime.lastError);
          return;
        }

        if (!response) {
          console.error("No response received from background script");
          return;
        }

        // Update toggle state
        if (typeof response.isEnabled === 'boolean') {
          enableToggle.checked = response.isEnabled;
        }

        // Update next break timer
        if (response.nextBreakIn) {
          if (typeof response.nextBreakIn === 'object') {
            // New format with minutes and seconds properties
            const minutes = response.nextBreakIn.minutes || 0;
            const seconds = response.nextBreakIn.seconds || 0;
            nextBreakTimer.textContent = `${padZero(minutes)}:${padZero(seconds)}`;
          } else {
            // Handle old format (if nextBreakIn is just a number)
            const nextBreakMinutes = Math.floor(response.nextBreakIn || 0);
            const nextBreakSeconds = Math.floor(((response.nextBreakIn || 0) - nextBreakMinutes) * 60);
            nextBreakTimer.textContent = `${padZero(nextBreakMinutes)}:${padZero(nextBreakSeconds)}`;
          }
        } else {
          nextBreakTimer.textContent = "20:00"; // Default fallback
        }

        // Update screen time
        if (typeof response.totalScreenTime === 'number') {
          const screenTimeHours = Math.floor(response.totalScreenTime / 60);
          const screenTimeMinutes = response.totalScreenTime % 60;
          screenTimeValue.textContent = `${screenTimeHours}:${padZero(screenTimeMinutes)}`;
        }

        // Update color temperature
        if (response.colorTemp) {
          colorTempValue.textContent = `${response.colorTemp}K`;
        }

        // Update breaks count
        if (typeof response.breakCount === 'number') {
          breaksValue.textContent = response.breakCount;
        }
      });
    } catch (error) {
      console.error("Error in refreshStats:", error);
    }
  }

  // Helper function to pad zeros for time display
  function padZero(num) {
    return num.toString().padStart(2, '0');
  }
});