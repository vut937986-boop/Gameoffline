window.NEON_BREW_TUTORIAL = Object.freeze({
  syncTutorialLock({ tutorialActive, guidedOutside, sessionStarted }) {
    document.body.classList.toggle('tutorial-lock', false);
    const shell = document.getElementById('gameShell');
    if (shell) {
      shell.style.pointerEvents = '';
      shell.style.userSelect = '';
      shell.removeAttribute('aria-hidden');
      shell.removeAttribute('inert');
    }

    document.querySelectorAll('.tutorial-target').forEach(el => {
      el.style.pointerEvents = 'auto';
      el.style.zIndex = '80';
    });

    const tutorialScreen = document.getElementById('tutorialScreen');
    const tutorialDock = document.getElementById('tutorialDock');
    if (tutorialScreen) {
      tutorialScreen.style.pointerEvents = 'auto';
      tutorialScreen.hidden = true;
    }
    if (tutorialDock) {
      tutorialDock.hidden = !(tutorialActive || sessionStarted);
      tutorialDock.style.pointerEvents = 'auto';
    }
  }
});
