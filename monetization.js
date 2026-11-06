/**
 * Monetization & Ad SDK Abstraction Layer
 * Cross-portal support for CrazyGames, GameMonetize, and Standalone / Mock testing.
 */
(function (window) {
  'use strict';

  let isAdActive = false;
  const pauseCallbacks = [];
  const resumeCallbacks = [];

  const AdManager = {
    provider: 'mock', // 'crazygames' | 'gamemonetize' | 'mock'
    initialized: false,
    adCount: 0,

    init: function (provider) {
      if (this.initialized) return;
      this.initialized = true;

      // Auto-detect provider from URL query param (?adprovider=crazygames|gamemonetize|mock)
      const params = new URLSearchParams(window.location.search);
      const queryProvider = params.get('adprovider') || params.get('provider');
      if (queryProvider) {
        provider = queryProvider.toLowerCase();
      }

      // Auto-detect if portal SDKs are already present on the page
      if (!provider) {
        if (window.CrazyGames && window.CrazyGames.SDK) {
          provider = 'crazygames';
        } else if (typeof window.sdk !== 'undefined') {
          provider = 'gamemonetize';
        } else {
          provider = 'mock';
        }
      }

      this.provider = provider || 'mock';
      console.log('[AdManager] Initialized with provider:', this.provider);

      if (this.provider === 'crazygames') {
        this._initCrazyGames();
      } else if (this.provider === 'gamemonetize') {
        this._initGameMonetize();
      }
    },

    onPauseGame: function (callback) {
      if (typeof callback === 'function') pauseCallbacks.push(callback);
    },

    onResumeGame: function (callback) {
      if (typeof callback === 'function') resumeCallbacks.push(callback);
    },

    _triggerPause: function (adType) {
      isAdActive = true;
      pauseCallbacks.forEach(fn => {
        try { fn(adType); } catch (e) { console.warn('[AdManager] Pause callback error:', e); }
      });
    },

    _triggerResume: function (adType) {
      isAdActive = false;
      resumeCallbacks.forEach(fn => {
        try { fn(adType); } catch (e) { console.warn('[AdManager] Resume callback error:', e); }
      });
    },

    _initCrazyGames: function () {
      if (!window.CrazyGames && !document.getElementById('crazygames-sdk')) {
        const s = document.createElement('script');
        s.id = 'crazygames-sdk';
        s.src = 'https://sdk.crazygames.com/crazygames-sdk-v2.js';
        s.async = true;
        document.head.appendChild(s);
      }
    },

    _initGameMonetize: function () {
      if (!window.sdk && !document.getElementById('gamemonetize-sdk')) {
        window.SDK_OPTIONS = {
          gameId: "YOUR_GAMEMONETIZE_ID",
          onEvent: function (event) {
            switch (event.name) {
              case "SDK_GAME_PAUSE":
                AdManager._triggerPause('midroll');
                break;
              case "SDK_GAME_START":
                AdManager._triggerResume('midroll');
                break;
              case "SDK_READY":
                console.log("[GameMonetize] SDK Ready");
                break;
            }
          }
        };
        const s = document.createElement('script');
        s.id = 'gamemonetize-sdk';
        s.src = 'https://api.gamemonetize.com/sdk.js';
        s.async = true;
        document.head.appendChild(s);
      }
    },

    /**
     * Shows a standard interstitial / midroll advertisement.
     * Pauses the game, displays the ad, and safely resumes via callback.
     */
    showMidroll: function (onCompleteCallback) {
      this.adCount++;
      const finish = () => {
        this._triggerResume('midroll');
        if (typeof onCompleteCallback === 'function') onCompleteCallback();
      };

      this._triggerPause('midroll');

      // Safety fallback: Never allow an ad to permanently lock the game
      const safetyTimer = setTimeout(() => {
        console.warn('[AdManager] Midroll ad safety timeout triggered');
        finish();
      }, 30000);

      const wrappedFinish = () => {
        clearTimeout(safetyTimer);
        finish();
      };

      // 1. CrazyGames implementation
      if (this.provider === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK) {
        try {
          window.CrazyGames.SDK.ad.requestAd("midroll", {
            adStarted: () => console.log('[CrazyGames] Midroll started'),
            adFinished: () => wrappedFinish(),
            adError: (e) => {
              console.warn('[CrazyGames] Midroll error:', e);
              wrappedFinish();
            }
          });
          return;
        } catch (e) {
          console.warn('[CrazyGames] Request ad exception:', e);
          wrappedFinish();
          return;
        }
      }

      // 2. GameMonetize implementation
      if (this.provider === 'gamemonetize' && typeof window.sdk !== 'undefined' && typeof window.sdk.showBanner !== 'undefined') {
        try {
          window.sdk.showBanner();
          setTimeout(wrappedFinish, 2000);
          return;
        } catch (e) {
          console.warn('[GameMonetize] Request banner exception:', e);
          wrappedFinish();
          return;
        }
      }

      // 3. Mock Ad Simulator for local play and portal sandboxes
      this._showMockAd('Commercial Break (Midroll)', 3, wrappedFinish);
    },

    /**
     * Shows a rewarded advertisement for in-game bonuses (revives, 2x coins).
     */
    showRewarded: function (rewardSuccessCallback, rewardFailCallback) {
      let rewarded = false;
      const finish = (success) => {
        this._triggerResume('rewarded');
        if (success && typeof rewardSuccessCallback === 'function') {
          rewardSuccessCallback();
        } else if (!success && typeof rewardFailCallback === 'function') {
          rewardFailCallback();
        }
      };

      this._triggerPause('rewarded');

      const safetyTimer = setTimeout(() => {
        console.warn('[AdManager] Rewarded ad safety timeout');
        finish(false);
      }, 45000);

      const wrappedFinish = (success) => {
        clearTimeout(safetyTimer);
        finish(success);
      };

      // 1. CrazyGames Rewarded
      if (this.provider === 'crazygames' && window.CrazyGames && window.CrazyGames.SDK) {
        try {
          window.CrazyGames.SDK.ad.requestAd("rewarded", {
            adStarted: () => console.log('[CrazyGames] Rewarded ad started'),
            adFinished: () => wrappedFinish(true),
            adError: (e) => {
              console.warn('[CrazyGames] Rewarded error:', e);
              wrappedFinish(false);
            }
          });
          return;
        } catch (e) {
          console.warn('[CrazyGames] Rewarded exception:', e);
          wrappedFinish(false);
          return;
        }
      }

      // 2. GameMonetize Rewarded
      if (this.provider === 'gamemonetize' && typeof window.sdk !== 'undefined' && typeof window.sdk.showBanner !== 'undefined') {
        try {
          window.sdk.showBanner();
          setTimeout(() => wrappedFinish(true), 2500);
          return;
        } catch (e) {
          console.warn('[GameMonetize] Rewarded exception:', e);
          wrappedFinish(false);
          return;
        }
      }

      // 3. Mock Rewarded Ad
      this._showMockRewardedAd(wrappedFinish);
    },

    _showMockAd: function (title, durationSeconds, onDone) {
      let remaining = durationSeconds;
      const overlay = document.createElement('div');
      overlay.id = 'ad-mock-interstitial';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(10, 15, 30, 0.95); color: #fff;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center; padding: 20px;
      `;

      overlay.innerHTML = `
        <div style="background: #1e293b; border: 2px solid #38bdf8; border-radius: 16px; padding: 28px 24px; max-width: 380px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #38bdf8; margin-bottom: 8px; font-weight: 700;">Sponsor Ad (Mock Simulation)</div>
          <h2 style="font-size: 22px; margin-bottom: 12px; color: #fff;">${title}</h2>
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Resuming game in <b id="ad-mock-timer" style="color: #f59e0b; font-size: 18px;">${remaining}</b>s...</p>
          <div style="height: 6px; width: 100%; background: #334155; border-radius: 999px; overflow: hidden; margin-bottom: 20px;">
            <div id="ad-mock-bar" style="height: 100%; width: 100%; background: #38bdf8; transition: width 1s linear;"></div>
          </div>
          <button id="ad-mock-skip" style="background: transparent; border: 1px solid #64748b; color: #94a3b8; padding: 8px 16px; border-radius: 8px; font-size: 12px; cursor: pointer;">Skip Ad (Dev Preview)</button>
        </div>
      `;

      document.body.appendChild(overlay);

      const timerEl = overlay.querySelector('#ad-mock-timer');
      const barEl = overlay.querySelector('#ad-mock-bar');
      const skipBtn = overlay.querySelector('#ad-mock-skip');

      const cleanup = () => {
        clearInterval(interval);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        onDone();
      };

      skipBtn.addEventListener('click', cleanup);

      const interval = setInterval(() => {
        remaining--;
        if (timerEl) timerEl.textContent = remaining;
        if (barEl) barEl.style.width = ((remaining / durationSeconds) * 100) + '%';
        if (remaining <= 0) {
          cleanup();
        }
      }, 1000);
    },

    _showMockRewardedAd: function (onDone) {
      let remaining = 4;
      const overlay = document.createElement('div');
      overlay.id = 'ad-mock-rewarded';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(15, 10, 30, 0.96); color: #fff;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center; padding: 20px;
      `;

      overlay.innerHTML = `
        <div style="background: #1e1b4b; border: 2px solid #c084fc; border-radius: 16px; padding: 28px 24px; max-width: 380px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #c084fc; margin-bottom: 8px; font-weight: 700;">Rewarded Video Sponsor</div>
          <h2 style="font-size: 22px; margin-bottom: 12px; color: #fff;">🎁 Claim In-Game Bonus</h2>
          <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 16px;">Watch this quick preview to receive your revive reward!</p>
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Reward in <b id="ad-mock-rew-timer" style="color: #c084fc; font-size: 18px;">${remaining}</b>s...</p>
          <div style="height: 6px; width: 100%; background: #312e81; border-radius: 999px; overflow: hidden; margin-bottom: 20px;">
            <div id="ad-mock-rew-bar" style="height: 100%; width: 100%; background: #c084fc; transition: width 1s linear;"></div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="ad-mock-rew-cancel" style="background: transparent; border: 1px solid #64748b; color: #94a3b8; padding: 8px 14px; border-radius: 8px; font-size: 12px; cursor: pointer;">No Thanks</button>
            <button id="ad-mock-rew-claim" style="background: #a855f7; border: none; color: #fff; font-weight: bold; padding: 8px 16px; border-radius: 8px; font-size: 12px; cursor: pointer;">Instant Reward (Dev)</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const timerEl = overlay.querySelector('#ad-mock-rew-timer');
      const barEl = overlay.querySelector('#ad-mock-rew-bar');
      const cancelBtn = overlay.querySelector('#ad-mock-rew-cancel');
      const claimBtn = overlay.querySelector('#ad-mock-rew-claim');

      const finish = (rewarded) => {
        clearInterval(interval);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        onDone(rewarded);
      };

      cancelBtn.addEventListener('click', () => finish(false));
      claimBtn.addEventListener('click', () => finish(true));

      const interval = setInterval(() => {
        remaining--;
        if (timerEl) timerEl.textContent = remaining;
        if (barEl) barEl.style.width = ((remaining / 4) * 100) + '%';
        if (remaining <= 0) {
          finish(true);
        }
      }, 1000);
    }
  };

  window.AdManager = AdManager;
})(window);

