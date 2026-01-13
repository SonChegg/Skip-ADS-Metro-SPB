// ==UserScript==
// @name         Skip-ADS-Metro-SPB
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Разблокировка доступа в интернет без просмотра рекламы
// @author       SonClick
// @match        *://*.wi-fi.ru/*
// @match        *://*.vmet.ro/*
// @match        *://*.gowifi.ru/*
// @grant        none
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('Metro-Hack v7.0 (Aggressive) started...');

    let isVideoHackActive = false;

    // --- 1. ВЗЛОМ ТАЙМЕРОВ ---
    const TIME_ACCELERATION = 50; 
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;

    window.setTimeout = function(func, delay) {
        return originalSetTimeout(func, delay > 10 ? delay / TIME_ACCELERATION : delay);
    };
    window.setInterval = function(func, delay) {
        return originalSetInterval(func, delay > 10 ? delay / TIME_ACCELERATION : delay);
    };

    // --- 2. ФУНКЦИЯ "ТЯЖЕЛОГО" КЛИКА ---
    function triggerEvents(element) {
        // Набор событий для эмуляции реального нажатия
        const events = [
            new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        ];

        // Отправляем события
        events.forEach(event => element.dispatchEvent(event));
        
        // Обычный клик (на всякий случай)
        element.click();

        // Эмуляция Touch (для iOS/Android)
        try {
            const touchEvent = new Event('touchstart', { bubbles: true });
            element.dispatchEvent(touchEvent);
            element.dispatchEvent(new Event('touchend', { bubbles: true }));
        } catch (e) {}
    }

    function tryClick(el, source) {
        if (el && el.offsetParent !== null) { 
            // 1. Рисуем рамку, чтобы видеть, что нашли
            el.style.border = "4px solid red";
            
            console.log(`[CLICK] Clicking on: ${source}`, el);

            // 2. Кликаем по САМОМУ элементу
            triggerEvents(el);

            // 3. Кликаем по РОДИТЕЛЮ (!!! ВАЖНО !!!)
            // Часто текст "Обычная поездка" лежит внутри span, а кликабельный div снаружи
            if (el.parentElement) {
                el.parentElement.style.border = "2px dashed yellow"; // Помечаем родителя
                triggerEvents(el.parentElement);
            }
        }
    }

    // --- 3. ПОИСК ---
    function scanAndClick() {
        const triggerKeyword = "обычная поездка";
        const alwaysClickKeywords = [
            "далее", "пропустить", "закрыть", "close", "skip", "войти", "next", "×", "✕", "✖"
        ];

        const elements = document.querySelectorAll('button, a, div, span, p, input');

        for (let el of elements) {
            let text = "";
            if (el.tagName === 'INPUT' && el.type === 'button') text = el.value || "";
            else text = el.innerText || "";
            
            text = text.toLowerCase().trim();
            if (!text || text.length > 50) continue; 

            // --- Кнопка "Обычная поездка" ---
            if (text.includes(triggerKeyword)) {
                isVideoHackActive = true; 
                tryClick(el, `MAIN TRIGGER: ${text}`);
                // Не делаем return, вдруг там еще кнопка "Далее" сразу
            }

            // --- Остальные кнопки ---
            if (alwaysClickKeywords.some(k => text.includes(k))) {
                tryClick(el, `ALWAYS: ${text}`);
            }
        }
        
        // Крестики (без текста)
        const closeIcons = document.querySelectorAll('[class*="close"], [class*="skip"], [class*="cross"]');
        for (let btn of closeIcons) {
             if (btn.offsetWidth > 0 && btn.offsetWidth < 100) {
                 // Тут родителя не кликаем, обычно крестик сам по себе кнопка
                 btn.style.border = "3px solid orange";
                 btn.click();
             }
        }
    }

    // --- 4. ВИДЕО ---
    function superFastVideo() {
        if (!isVideoHackActive) return;

        const videos = document.querySelectorAll('video');
        for (let v of videos) {
            if (v.playbackRate !== 16.0 && !v.ended) {
                v.muted = true;
                v.playbackRate = 16.0; 
                v.play().catch(() => {});
                v.style.border = "5px solid blue"; 
            }
        }
    }

    // Запуск цикла
    setInterval(() => {
        try {
            scanAndClick();   
            superFastVideo(); 
        } catch (e) {}
    }, 400);

})();
