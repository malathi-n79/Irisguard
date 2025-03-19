document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const closeButton = document.getElementById('closeButton');
  const snoozeButton = document.getElementById('snoozeButton');
  const startBreakButton = document.getElementById('startBreakButton');
  const screenTimeValue = document.getElementById('screenTimeValue');
  const colorTempValue = document.getElementById('colorTempValue');
  const breaksValue = document.getElementById('breaksValue');
  const progressBar = document.getElementById('progressBar');
  const breakTimer = document.getElementById('breakTimer');
  const timerText = document.getElementById('timerText');
  const timerCircle = document.getElementById('timerCircle');

  // Hide break timer initially
  breakTimer.style.display = 'none';

  // Fetch initial stats
  refreshStats();

  // Set random progress on the progress bar (30-80%)
  const randomProgress = Math.floor(Math.random() * 50) + 30;
  progressBar.style.width = `${randomProgress}%`;

  // Close button handler
  closeButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'snoozeBreak' }, function(response) {
      // Close window after response
      window.close();
    });
  });

  // Snooze button handler
  snoozeButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'snoozeBreak' }, function(response) {
      // Close window after response
      window.close();
    });
  });

  // Start break button handler
  startBreakButton.addEventListener('click', function() {
    // Hide the action buttons and show timer
    document.querySelector('.action-buttons').style.display = 'none';
    breakTimer.style.display = 'block';

    // Start the 20-second countdown
    startCountdown(20);
  });

  // Function to refresh stats
  function refreshStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, function(response) {
      if (response) {
        // Update screen time
        const screenTimeHours = Math.floor(response.totalScreenTime / 60);
        const screenTimeMinutes = response.totalScreenTime % 60;
        screenTimeValue.textContent = `${screenTimeHours}:${padZero(screenTimeMinutes)}`;

        // Update color temperature
        colorTempValue.textContent = `${response.colorTemp}K`;

        // Update breaks count
        breaksValue.textContent = response.breakCount;
      }
    });
  }

  // Helper function to pad zeros for time display
  function padZero(num) {
    return num.toString().padStart(2, '0');
  }

  // Function to start the countdown timer
  function startCountdown(seconds) {
    let remainingSeconds = seconds;
    const circumference = 2 * Math.PI * 45; // 2πr where r=45

    // Update timer text
    timerText.textContent = remainingSeconds;

    // Animation for the timer circle
    const interval = setInterval(() => {
      remainingSeconds--;

      // Update timer text
      timerText.textContent = remainingSeconds;

      // Update circle progress
      const offset = circumference * (1 - remainingSeconds / seconds);
      timerCircle.style.strokeDasharray = circumference;
      timerCircle.style.strokeDashoffset = offset;

      if (remainingSeconds <= 0) {
        clearInterval(interval);

        // Break finished, notify background script and close window
        chrome.runtime.sendMessage({ action: 'startBreak' }, function(response) {
          console.log("Break completed successfully", response);
          // Make sure to close the window after sending the message
          setTimeout(() => {
            window.close();
          }, 500); // Small delay to ensure message is processed
        });
      }
    }, 1000);
  }
});