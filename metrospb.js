// ==UserScript==
// @name         Skip-ADS-Metro-SPB
// @namespace    https://github.com/SonChegg/Skip-ADS-Metro-SPB
// @version      2.0.0
// @description  Автоматически проходит рекламные экраны Wi-Fi в метро Санкт-Петербурга
// @author       SonClick
// @match        *://*.wi-fi.ru/*
// @match        *://wi-fi.ru/*
// @match        *://*.vmet.ro/*
// @match        *://vmet.ro/*
// @match        *://*.gowifi.ru/*
// @match        *://gowifi.ru/*
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/SonChegg/Skip-ADS-Metro-SPB/main/metrospb.js
// @updateURL    https://raw.githubusercontent.com/SonChegg/Skip-ADS-Metro-SPB/main/metrospb.js
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '2.0.0';
    const TIMER_ACCELERATION = 20;
    const MIN_ACCELERATED_DELAY = 1000;
    const MAX_ACCELERATED_DELAY = 60000;
    const MIN_RESULT_DELAY = 100;
    const CLICK_COOLDOWN = 3000;
    const SCAN_DEBOUNCE = 80;
    const FALLBACK_SCAN_INTERVAL = 1500;
    const MAX_TEXT_LENGTH = 80;
    const VIDEO_RATE = 16;

    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);
    const lastClickedAt = new WeakMap();
    let scanTimer = null;

    const actionPatterns = [
        /^обычная поездка$/iu,
        /^далее$/iu,
        /^пропустить(?: рекламу)?$/iu,
        /^закрыть$/iu,
        /^войти(?: в интернет)?$/iu,
        /^продолжить$/iu,
        /^skip(?: ad)?$/iu,
        /^close$/iu,
        /^next$/iu,
        /^[×✕✖]$/u
    ];

    const clickableSelector = [
        'button',
        'a[href]',
        '[role="button"]',
        'input[type="button"]',
        'input[type="submit"]'
    ].join(',');

    function accelerateDelay(delay) {
        const numericDelay = Number(delay);

        if (!Number.isFinite(numericDelay)) return delay;
        if (numericDelay < MIN_ACCELERATED_DELAY || numericDelay > MAX_ACCELERATED_DELAY) {
            return numericDelay;
        }

        return Math.max(MIN_RESULT_DELAY, numericDelay / TIMER_ACCELERATION);
    }

    // Сохраняем нативную сигнатуру, включая дополнительные аргументы callback.
    window.setTimeout = function (handler, delay, ...args) {
        return nativeSetTimeout(handler, accelerateDelay(delay), ...args);
    };

    window.setInterval = function (handler, delay, ...args) {
        return nativeSetInterval(handler, accelerateDelay(delay), ...args);
    };

    function normalizeText(value) {
        return String(value || '')
            .replace(/\s+/gu, ' ')
            .trim()
            .toLowerCase();
    }

    function getElementText(element) {
        if (element instanceof HTMLInputElement) {
            return normalizeText(element.value || element.getAttribute('aria-label'));
        }

        return normalizeText(
            element.innerText ||
            element.textContent ||
            element.getAttribute('aria-label') ||
            element.getAttribute('title')
        );
    }

    function isActionText(text) {
        return text.length > 0 &&
            text.length <= MAX_TEXT_LENGTH &&
            actionPatterns.some((pattern) => pattern.test(text));
    }

    function isVisibleAndEnabled(element) {
        if (!(element instanceof HTMLElement)) return false;
        if (element.matches(':disabled, [aria-disabled="true"]')) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function canClick(element) {
        const lastClick = lastClickedAt.get(element) || 0;
        return Date.now() - lastClick >= CLICK_COOLDOWN;
    }

    function clickElement(element, reason) {
        if (!isVisibleAndEnabled(element) || !canClick(element)) return false;

        lastClickedAt.set(element, Date.now());
        console.info(`[Skip-ADS ${VERSION}] Нажимаю: ${reason}`);
        element.click();
        return true;
    }

    function findClickableElements(root) {
        if (!(root instanceof Element || root instanceof Document)) return [];

        const elements = [];
        if (root instanceof Element && root.matches(clickableSelector)) elements.push(root);
        elements.push(...root.querySelectorAll(clickableSelector));
        return elements;
    }

    function processControls(root = document) {
        for (const element of findClickableElements(root)) {
            const text = getElementText(element);
            if (isActionText(text)) clickElement(element, text);
        }

        // На портале подпись иногда лежит в span/p или в "голом" div,
        // а обработчик клика висит выше. click() всплывёт до обработчика,
        // при этом мы не долбим подряд сам элемент и всех его родителей.
        const textFallbackSelector = 'span, p, div';
        for (const element of root.querySelectorAll?.(textFallbackSelector) || []) {
            if (element.closest(clickableSelector)) continue;
            if (element.children.length > 0) continue;

            const text = getElementText(element);
            if (isActionText(text)) clickElement(element, text);
        }

        const iconSelectors = [
            '[aria-label*="закрыть" i]',
            '[aria-label*="close" i]',
            '[title*="закрыть" i]',
            '[title*="close" i]',
            'button[class*="close" i]',
            'button[class*="skip" i]',
            '[role="button"][class*="close" i]',
            '[role="button"][class*="skip" i]'
        ].join(',');

        for (const element of root.querySelectorAll?.(iconSelectors) || []) {
            clickElement(element, getElementText(element) || 'кнопка закрытия');
        }
    }

    function processVideos(root = document) {
        const videos = [];
        if (root instanceof HTMLVideoElement) videos.push(root);
        if (root.querySelectorAll) videos.push(...root.querySelectorAll('video'));

        for (const video of videos) {
            if (video.ended) continue;

            video.muted = true;
            try {
                video.playbackRate = VIDEO_RATE;
                video.defaultPlaybackRate = VIDEO_RATE;
            } catch (error) {
                console.debug(`[Skip-ADS ${VERSION}] Не удалось ускорить видео`, error);
            }

            const playPromise = video.play();
            if (playPromise?.catch) playPromise.catch(() => {});
        }
    }

    function scan(root = document) {
        try {
            processControls(root);
            processVideos(root);
        } catch (error) {
            console.debug(`[Skip-ADS ${VERSION}] Ошибка сканирования`, error);
        }
    }

    function scheduleScan(root = document) {
        if (scanTimer !== null) return;

        scanTimer = nativeSetTimeout(() => {
            scanTimer = null;
            scan(root);
        }, SCAN_DEBOUNCE);
    }

    function start() {
        console.info(`[Skip-ADS ${VERSION}] Запущен на ${location.hostname}`);
        scan(document);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    scheduleScan(document);
                    return;
                }

                if (mutation.type === 'attributes') {
                    scheduleScan(document);
                    return;
                }
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled']
        });

        // Редкая страховочная проверка для изменений, которые не меняют DOM.
        nativeSetInterval(() => scan(document), FALLBACK_SCAN_INTERVAL);
    }

    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
