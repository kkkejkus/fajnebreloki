document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    // --- Admin mode (do not track GA + keep admin=1 across internal navigation) ---
    const isTruthyFlag = (v) => {
        const s = String(v ?? '').toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    };

    const isAdminModeFromLocation = () => {
        const path = String(window.location.pathname || '');
        const isAdminPath = /^\/admin(?:\/|$)/i.test(path);

        const params = new URLSearchParams(window.location.search);
        const isAdminQuery = isTruthyFlag(params.get('admin'));

        const hash = String(window.location.hash || '');
        const isAdminHash = /^#\/?admin(?:\/|$)/i.test(hash);

        return isAdminPath || isAdminQuery || isAdminHash;
    };

    // Persist within the session (re-renders / pushState).
    window.__adminMode = Boolean(window.__adminMode) || isAdminModeFromLocation();

    const withAdminParam = (href) => {
        if (!window.__adminMode) return href;
        const raw = String(href ?? '');
        const trimmed = raw.trim();
        if (!trimmed) return href;
        if (trimmed.startsWith('#')) return href;
        if (/^(mailto:|tel:|javascript:)/i.test(trimmed)) return href;

        let url;
        try {
            url = new URL(trimmed, window.location.href);
        } catch {
            return href;
        }

        if (url.origin !== window.location.origin) return href;
        url.searchParams.set('admin', '1');
        return url.pathname + url.search + url.hash;
    };

    const rewriteInternalLinksForAdmin = (root = document) => {
        if (!window.__adminMode) return;
        const links = root.querySelectorAll?.('a[href]');
        if (!links) return;
        links.forEach((a) => {
            const href = a.getAttribute('href');
            if (!href) return;
            const h = href.trim();
            // Keep scope tight: only rewrite links pointing to index.html (your SPA entrypoint)
            if (/^(?:\.\/)?index\.html(?:[?#].*)?$/i.test(h) || /^index\.html[?#]/i.test(h) || /^\/index\.html/i.test(h) || /^\.\/index\.html/i.test(h)) {
                a.setAttribute('href', withAdminParam(href));
            }
        });
    };

    // Initial rewrite for navbar/footer links.
    rewriteInternalLinksForAdmin(document);

    // Auto-rewrite links inserted later via innerHTML renders.
    if (window.__adminMode && !window.__adminLinkObserver && typeof MutationObserver !== 'undefined') {
        window.__adminLinkObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes || []) {
                    if (node && node.nodeType === 1) {
                        rewriteInternalLinksForAdmin(node);
                    }
                }
            }
        });
        window.__adminLinkObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Reviews: last update indicator (auto-updating)
    const REVIEWS_LAST_UPDATED_AT = new Date(2026, 1, 21, 20, 0, 0); // 02.02.2026 20:00 (local time)

    const formatTimeAgo = (sinceDate) => {
        const sinceMs = sinceDate?.getTime?.();
        if (!Number.isFinite(sinceMs)) return '';

        const diffMs = Math.max(0, Date.now() - sinceMs);
        const totalMinutes = Math.floor(diffMs / 60000);

        if (totalMinutes < 60) {
            return `${totalMinutes} min temu`;
        }

        const totalHours = Math.floor(diffMs / 3600000);
        if (totalHours < 24) {
            return `${totalHours} godz. temu`;
        }

        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        return `${days} dni ${hours} godz. temu`;
    };

    const updateReviewsLastUpdatedLabel = () => {
        const el = document.getElementById('reviewsUpdated');
        if (!el) return;
        const txt = formatTimeAgo(REVIEWS_LAST_UPDATED_AT);
        el.textContent = txt ? `Ostatnia aktualizacja: ${txt}` : 'Ostatnia aktualizacja: nieznana';
    };

    const ensureReviewsLastUpdatedTicker = () => {
        updateReviewsLastUpdatedLabel();
        if (window.__reviewsUpdatedInterval) return;
        window.__reviewsUpdatedInterval = window.setInterval(updateReviewsLastUpdatedLabel, 60_000);
    };

    const REVIEWS_SCROLL_STORAGE_KEY = 'reviewsScrollLeft';
    const REVIEWS_SCROLL_USER_KEY = 'reviewsScrollUser';

    const initReviewsScrollPosition = () => {
        const scroller = document.getElementById('reviewsScroll');
        if (!scroller) return;

        const getSession = (k) => {
            try {
                return sessionStorage.getItem(k);
            } catch {
                return null;
            }
        };

        const setSession = (k, v) => {
            try {
                sessionStorage.setItem(k, v);
            } catch {
                // ignore
            }
        };

        const applyScroll = () => {
            const max = scroller.scrollWidth - scroller.clientWidth;
            if (!(max > 0)) return;

            const userHasScrolled = getSession(REVIEWS_SCROLL_USER_KEY) === '1';
            const restoreRaw = userHasScrolled ? getSession(REVIEWS_SCROLL_STORAGE_KEY) : null;
            const restore = restoreRaw !== null ? Number(restoreRaw) : null;

            const computeMiddleCardScrollLeft = () => {
                const cards = Array.from(scroller.querySelectorAll('.review-card'));
                if (!cards.length) return max / 2;
                const middleIndex = Math.floor(cards.length / 2); // 11 -> 5 (6th)
                const el = cards[middleIndex];
                if (!el) return max / 2;

                const left = el.offsetLeft;
                const width = el.offsetWidth || el.getBoundingClientRect().width;
                const targetLeft = left + (width / 2) - (scroller.clientWidth / 2);
                return Math.max(0, Math.min(max, targetLeft));
            };

            const target = Number.isFinite(restore) ? restore : computeMiddleCardScrollLeft();

            scroller.__programmaticScroll = true;
            scroller.scrollLeft = Math.max(0, Math.min(max, target));
            // Let the scroll event (if any) fire, then drop the flag.
            requestAnimationFrame(() => {
                scroller.__programmaticScroll = false;
            });
        };

        // Wait for layout/scrollWidth to be correct.
        requestAnimationFrame(() => requestAnimationFrame(applyScroll));

        // Re-apply when content width changes (e.g. images load), but only before user scrolls.
        if (!scroller.__resizeObserverAttached && typeof ResizeObserver !== 'undefined') {
            scroller.__resizeObserverAttached = true;
            scroller.__reviewsResizeObserver = new ResizeObserver(() => {
                if (getSession(REVIEWS_SCROLL_USER_KEY) === '1') return;
                applyScroll();
            });
            scroller.__reviewsResizeObserver.observe(scroller);
        }

        if (!scroller.__saveHandlerAttached) {
            scroller.__saveHandlerAttached = true;
            scroller.addEventListener('scroll', () => {
                if (scroller.__programmaticScroll) return;

                setSession(REVIEWS_SCROLL_USER_KEY, '1');
                window.clearTimeout(scroller.__saveScrollT);
                scroller.__saveScrollT = window.setTimeout(() => {
                    setSession(REVIEWS_SCROLL_STORAGE_KEY, String(scroller.scrollLeft));
                }, 150);
            }, { passive: true });
        }
    };

    // Currency Logic (PLN/EUR)
    const EUR_RATE_PLN = 4.35; // PLN za 1 EUR (stały kurs do prostych przeliczeń)
    const CURRENCY_STORAGE_KEY = 'currency';

    const getCurrency = () => {
        const v = localStorage.getItem(CURRENCY_STORAGE_KEY);
        return v === 'EUR' ? 'EUR' : 'PLN';
    };

    const setCurrency = (currency) => {
        localStorage.setItem(CURRENCY_STORAGE_KEY, currency === 'EUR' ? 'EUR' : 'PLN');
    };

    const convertPlnToCurrency = (amountPln, currency) => {
        const pln = Number(amountPln);
        if (!Number.isFinite(pln)) return null;
        if (currency === 'EUR') return pln / EUR_RATE_PLN;
        return pln;
    };

    const formatMoney = (amountPln) => {
        const currency = getCurrency();
        const converted = convertPlnToCurrency(amountPln, currency);
        if (converted === null) return '';
        const value = converted.toFixed(2);
        return currency === 'EUR' ? `€ ${value}` : `${value} zł`;
    };

    const formatMoneyInline = (amountPln) => {
        const currency = getCurrency();
        const converted = convertPlnToCurrency(amountPln, currency);
        if (converted === null) return '';
        const value = converted.toFixed(2);
        return currency === 'EUR' ? `${value} €` : `${value} zł`;
    };

    const updateCurrencyToggleLabel = () => {
        const btn = document.getElementById('currencyToggle');
        if (!btn) return;
        btn.textContent = getCurrency() === 'EUR'
            ? 'Zmień walutę: € (EUR)'
            : 'Zmień walutę: zł (PLN)';
        btn.title = 'Kliknij, aby przełączyć walutę cen';
    };

    const rerenderCurrentView = () => {
        const products = window.__productsCache;
        if (!products) return;

        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        const page = urlParams.get('page');

        if (productId) return renderProductDetail(productId, products);
        if (page === 'contact') return renderContactPage();
        if (page === 'shipping') return renderShippingPage();
        if (page === 'faq') return renderFaqPage();
        if (page === 'privacy') return renderPrivacyPage();
        return renderLandingPage(products);
    };

    const currencyToggleBtn = document.getElementById('currencyToggle');
    if (currencyToggleBtn) {
        updateCurrencyToggleLabel();
        currencyToggleBtn.addEventListener('click', () => {
            setCurrency(getCurrency() === 'EUR' ? 'PLN' : 'EUR');
            updateCurrencyToggleLabel();
            rerenderCurrentView();
        });
    }

    const trackGaPageView = () => {
        if (typeof window.gtag !== 'function') return;

        // Keep __adminMode updated if URL changes.
        window.__adminMode = Boolean(window.__adminMode) || isAdminModeFromLocation();
        if (window.__adminMode) return;

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        window.gtag('event', 'page_view', {
            page_location: window.location.href,
            page_path: window.location.pathname + window.location.search,
            page_title: document.title,
            ...(isLocalhost ? { debug_mode: true } : {}),
        });
    };

    const setNavSearchVisible = (isVisible) => {
        const navSearchContainer = document.getElementById('navSearchContainer');
        if (!navSearchContainer) return;
        // This element is now the landing toolbar (block-level). Forcing display:flex
        // here can break width calculations and prevent the search from expanding.
        navSearchContainer.style.display = isVisible ? '' : 'none';
    };

    // Set initial visibility ASAP to avoid flicker on page reloads.
    const initialParams = new URLSearchParams(window.location.search);
    setNavSearchVisible(!initialParams.get('page') && !initialParams.get('id'));

    // Theme Logic
    const themeToggleBtn = document.getElementById('themeToggle');
    const body = document.body;

    const updateThemeToggleLabel = (isDark) => {
        if (!themeToggleBtn) return;
        themeToggleBtn.textContent = `Zmień motyw: ${isDark ? '🌛' : '🌤️'}`;
        themeToggleBtn.title = isDark
            ? 'Kliknij, aby przełączyć na tryb jasny'
            : 'Kliknij, aby przełączyć na tryb ciemny';
    };
    
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        body.classList.add('dark-mode');
        updateThemeToggleLabel(true);
    } else {
        updateThemeToggleLabel(false);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');

            updateThemeToggleLabel(isDark);
            
            // Save preference
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    const renderDescriptionWithLineGaps = (raw) => {
        const text = String(raw || '').replace(/\r\n/g, '\n');
        return text
            .split('\n')
            .map(line => {
                if (!line.trim()) return '<span class="desc-break" aria-hidden="true"></span>';
                return `<span class="desc-line">${line}</span>`;
            })
            .join('');
    };

    function populateCategoryDropdown(products) {
        const artistList = document.getElementById('artistList');
        if (!artistList) return;

        // Calculate counts
        const allCount = products.filter(p => !p.isCustom).length;
        const polishCount = products.filter(p => !p.isCustom && p.isPolish).length;
        const foreignCount = products.filter(p => !p.isCustom && !p.isPolish).length;

        const extractArtists = (p) => {
            if (!p || p.isCustom) return [];
            const a = p.artist;
            if (!a || a === 'Custom') return [];
            return String(a)
                .split('&')
                .map(x => String(x).trim())
                .filter(Boolean);
        };

        const artists = [...new Set(products.flatMap(extractArtists))]
            .sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));

        const extractGenres = (p) => {
            if (!p || p.isCustom) return [];
            const g = p.genre;
            if (!g) return [];
            if (Array.isArray(g)) return g.filter(Boolean).map(x => String(x).trim()).filter(Boolean);
            return [String(g).trim()].filter(Boolean);
        };

        const genres = [...new Set(
            products.flatMap(extractGenres)
        )].sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));

        // Helper to create link
        const createLink = (text, filterType, filterValue, isSpecial = false, inputLabel = null) => {
            const link = document.createElement('a');
            link.href = "#";
            link.textContent = text;
            if (isSpecial) {
                link.style.textDecoration = "underline";
            }

            link.onclick = (e) => {
                e.preventDefault();

                // Set global filter state
                window.currentCategoryFilter = filterType;
                window.currentCategoryValue = filterValue;
                window.currentInputLabel = inputLabel || filterValue;

                // Persist desired input value across landing page re-renders (search box lives inside landing now).
                window.__searchTermCache = inputLabel || filterValue || '';

                // Set search input to label (for display)
                const searchInput = document.getElementById('navSearchInput');
                if (searchInput) {
                    searchInput.value = inputLabel || filterValue || "";
                }

                // If not on landing page, go there
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('page') || urlParams.get('id')) {
                    window.history.pushState({}, '', withAdminParam('index.html'));
                }

                renderLandingPage(products);
            };
            return link;
        };

        const divider = () => {
            const d = document.createElement('div');
            d.style.borderTop = "1px solid #eee";
            d.style.margin = "5px 0";
            return d;
        };

        // Clear existing
        artistList.innerHTML = '';

        // Add Special Options
        artistList.appendChild(createLink(`WSZYSTKIE (${allCount})`, 'ALL', null, true, ''));
        artistList.appendChild(createLink(`POLSKIE (${polishCount})`, 'POLISH', null, true, 'Polskie albumy'));
        artistList.appendChild(createLink(`ZAGRANICZNE (${foreignCount})`, 'FOREIGN', null, true, 'Zagraniczne albumy'));

        // Divider
        artistList.appendChild(divider());

        // Genres section (between special options and artists)
        if (genres.length > 0) {
            genres.forEach(genre => {
                const count = products.filter(p => !p.isCustom && extractGenres(p).includes(genre)).length;
                artistList.appendChild(createLink(`${genre} (${count})`, 'GENRE', genre, true, genre));
            });

            artistList.appendChild(divider());
        }

        // Add Artists
        artists.forEach(artist => {
            const count = products.filter(p => !p.isCustom && extractArtists(p).includes(artist)).length;
            artistList.appendChild(createLink(`${artist} (${count})`, 'ARTIST', artist, false, artist));
        });
    }

    // Global Filter State
    window.currentCategoryFilter = 'ALL'; // ALL, POLISH, FOREIGN, GENRE, ARTIST
    window.currentCategoryValue = null;
    window.currentInputLabel = null;
    window.currentSortMode = window.currentSortMode || 'NONE'; // NONE, ARTIST_ASC/DESC, ALBUM_ASC/DESC, GENRE_ASC/DESC

    // Preload hero images early to avoid a brief blank state on first render
    ['media/main1.png', 'media/main2.png'].forEach(src => {
        const img = new Image();
        img.src = src;
    });

    // Pobierz dane produktów
    fetch('products.json')
        .then(response => response.json())
        .then(products => {
            // Cache for quick re-renders (e.g. currency toggle)
            window.__productsCache = products;

            // Process products to add name and description if missing
            products.forEach(p => {
                if (!p.isCustom) {
                    p.name = `${p.artist} „${p.album}”`;
                    p.description = `🎶 Ręcznie stworzony brelok (5cm×4.5cm×0.8cm) inspirowany kultowym albumem ${p.album}.\n💿 Wyposażony w chip NFC, który po zbliżeniu telefonu automatycznie otwiera album w Spotify.\n📱 W wiadomości przy zakupie możesz wskazać inną aplikację — np. Apple Music.\n\n✨ Jeśli interesuje cię inny album, sprawdź pozostałe oferty lub zamów brelok spersonalizowany według Ciebie!\n💰 Przy zakupie kilku breloków <b>duża promka!</b>`;
                }
            });

            // Global Search Input Listener
            const navSearchInput = document.getElementById('navSearchInput');
            if (navSearchInput) {
                navSearchInput.addEventListener('input', (e) => {
                    const term = e.target.value;

                    // Reset filter if typing (Global listener for non-landing pages)
                    if (window.currentInputLabel && term !== window.currentInputLabel) {
                        window.currentCategoryFilter = 'ALL';
                        window.currentCategoryValue = null;
                        window.currentInputLabel = null;
                    }
                    
                    // If we are not on landing page, go there
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('page') || urlParams.get('id')) {
                        // Update URL without reload
                        window.history.pushState({}, '', withAdminParam('index.html'));
                        renderLandingPage(products);
                        
                        // Restore value and focus
                        const newInput = document.getElementById('navSearchInput');
                        newInput.value = term;
                        newInput.focus();
                    }
                });
            }

            // Sprawdź parametry URL
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id');
            const page = urlParams.get('page');

            if (productId) {
                renderProductDetail(productId, products);
            } else if (page === 'contact') {
                renderContactPage();
            } else if (page === 'shipping') {
                renderShippingPage();
            } else if (page === 'faq') {
                renderFaqPage();
            } else if (page === 'privacy') {
                renderPrivacyPage();
            } else {
                renderLandingPage(products);
            }
        })
        .catch(error => {
            console.error('Błąd ładowania produktów:', error);
            app.innerHTML = '<p style="text-align:center; color:red;">Nie udało się załadować produktów. Spróbuj odświeżyć stronę.</p>';
        });

    // Funkcja renderująca stronę kontaktową
    function renderContactPage() {
        setNavSearchVisible(false);

        document.title = 'Kontakt - FajneBreloki.pl';
        app.innerHTML = `
            <div class="contact-container" style="max-width: 800px; margin: 0 auto; padding: 40px 20px; background: white; border-radius: 0 0 20px 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.05);">
                <h1 style="text-align: center; margin: 0 20px 40px; line-height: 1.2; margin-left: ">Skontaktuj się ze mną 📞</h1>
                
                <div class="contact-grid">
                    <div style="text-align: center; padding: 30px; background: #f9f9f9; border-radius: 15px;">
                        <h3 style="margin-bottom: 8px;">📧 Email</h3>
                        <p style="font-size: 1.1rem;">
                            <a href="mailto:kamiljama@gmail.com" title="Kliknij, aby napisać maila" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">kamiljama@gmail.com</a>
                        </p>
                        <p style="margin-top: 8px; color: var(--muted-text-color); font-size: 0.9rem;">Odpisuję zazwyczaj w ciągu 12h</p>
                    </div>

                    <div style="text-align: center; padding: 30px; background: #f9f9f9; border-radius: 15px;">
                        <h3 style="margin-bottom: 8px;">📸 Instagram</h3>
                        <p style="font-size: 1.1rem;">
                            <a href="https://instagram.com/kkkejkus" title="Kliknij, aby przejść do Instagrama" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">@kkkejkus</a>
                        </p>
                        <p style="margin-top: 8px; color: var(--muted-text-color); font-size: 0.9rem;">Odpisuję zazwyczaj w ciągu 1h</p>
                    </div>
                </div>

                <div style="margin-top: 40px; text-align: center;">
                    <h3>Masz konkretne pytanie? 💬</h3>
                    <p style="color: var(--muted-text-color); margin-top: 8px;">
                        Najszybciej skontaktujesz się ze mną poprzez wiadomość prywatną na Instagramie.<br/>Odpowiedzi na maile mogą czasem zająć trochę więcej czasu.
                    </p>
                </div>
            </div>
        `;

        trackGaPageView();
    }

    // Funkcja renderująca stronę główną
    function renderLandingPage(products) {
        document.title = 'FajneBreloki.pl';

        const SORT_OPTIONS = [
            { key: 'ARTIST_ASC', label: 'ARTYSTA ↑' },
            { key: 'ARTIST_DESC', label: 'ARTYSTA ↓' },
            { key: 'ALBUM_ASC', label: 'ALBUM ↑' },
            { key: 'ALBUM_DESC', label: 'ALBUM ↓' },
            { key: 'GENRE_ASC', label: 'GATUNEK ↑' },
            { key: 'GENRE_DESC', label: 'GATUNEK ↓' },
            { key: 'NONE', label: 'NIE SORTUJ' },
        ];

        // 2. Renderuj szkielet strony (Hero + Grid Container)
        const html = `
            <section class="hero">
                <div class="hero-content">
                    <h1>Muzyka zawsze przy Tobie 🎶</h1>
                    <p>Unikalne breloki w kształcie mini płyt CD z chipem NFC.<br/>Zbliż telefon i odtwarzaj swój ulubiony album w Spotify! 🎧</p>
                </div>
                <div class="hero-image">
                    <img id="heroImageA" class="hero-image-layer active tilt-left" src="media/main1.png" alt="Gotowy brelok" style="cursor: zoom-in;" decoding="async" loading="eager" fetchpriority="high">
                    <img id="heroImageB" class="hero-image-layer hero-image-layer-overlay tilt-left" src="media/main1.png" alt="Gotowy brelok" aria-hidden="true" style="cursor: zoom-in;" decoding="async" loading="eager" fetchpriority="high">
                </div>
            </section>

            <section class="reviews-section" aria-labelledby="reviewsTitle">
                <div class="reviews-header">
                    <h2 id="reviewsTitle">Opinie klientów</h2>
                    <div class="reviews-summary" aria-label="Podsumowanie opinii">
                        <span class="reviews-badge"><span class="reviews-num">145+</span> <span class="reviews-label">opinii</span></span>
                        <span class="reviews-dot" aria-hidden="true">•</span>
                        <span class="reviews-badge"><span class="reviews-label">Średnia</span> <span class="reviews-num">5.0</span></span>
                        <span class="reviews-stars" aria-hidden="true">★★★★★</span>
                    </div>
                    <div class="reviews-updated" id="reviewsUpdated" aria-live="polite"></div>
                </div>

                <div class="reviews-scroll" id="reviewsScroll" role="list" aria-label="Lista opinii klientów">
                    <article class="review-card" role="listitem" data-index="1.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://marketplace-web-assets.vinted.com/assets/no-photo/user-empty-state.svg" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">13.02.2026</div>
                        <div class="review-nick">@zuzk***</div>
                        <div class="review-text">polecam szybką wysyłka super kontakt ze sprzedającym produkt zajebisty</div>
                    </article>
                
                    <article class="review-card" role="listitem" data-index="2.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/03_01492_xp2aDoJTTGHxf93w6hhV6ArQ/f800/1723133082.webp?s=f91edf0af47f577b50a667978a9c16964a080322" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">6.02.2026</div>
                        <div class="review-nick">@mei.***</div>
                        <div class="review-text">wszystko super, bardzo miły sprzedawca</div>
                    </article>
                
                    <article class="review-card" role="listitem" data-index="3.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/02_00644_Rn8yBUynhWViQa6A6DdYyE7b/f800/1729016381.webp?s=ed6457ca712aed94dfac102467fff7dafd093fa3" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">6.02.2026</div>
                        <div class="review-nick">@grav***</div>
                        <div class="review-text">I bought a custom mini album and i love it, i have the original album as well and it looks spot on 🕷️</div>
                    </article>
                
                    <article class="review-card" role="listitem" data-index="4.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/04_00a64_UG1GYwuxMiUjXGTnxQZUhCV6/f800/1760890077.webp?s=18fd6a45186d2d03a0291c6185b68c565acf41c0" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">1.02.2026</div>
                        <div class="review-nick">@bran***</div>
                        <div class="review-text">Brelok świetny</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="5.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/06_02468_7JeZEwrAumZUWyekH1nqurTa/f800/1769713921.webp?s=480cd98d1b16f019662e4cef0783b26db4da4b85" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">29.01.2026</div>
                        <div class="review-nick">@gyer***</div>
                        <div class="review-text">The item shipping and packaging were totally alright, and it gives everything what was promised! Looks nice. I can recommend the seller :)</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="6.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/02_02103_Hpy694GxUGP71iGaXjJ836dq/f800/1752070120.webp?s=e8eeee5a64ee76719837edee43a231fb3d46831d" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">22.01.2026</div>
                        <div class="review-nick">@nats***</div>
                        <div class="review-text">Wszystko dobrze 👍 polecam serdecznie 🛍️</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="7.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/01_01a45_wKsRhTEKvDXN3L1Ww88qV1sq/f800/1756043385.webp?s=da5b99d150ffd586d644b7cc965d3a4cdd42aaaf" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">21.01.2026</div>
                        <div class="review-nick">fore***</div>
                        <div class="review-text">Szybka wysyłka, a brelok piękny i bezpiecznie zapakowany 🫡</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="8.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/04_020a3_gVLNUWm99yJJh8asfboAtj3L/f800/1733922291.webp?s=d66099a6578db9e8937ebbd2f41544d5210025df" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">19.01.2026</div>
                        <div class="review-nick">@gove***</div>
                        <div class="review-text">As described, quality product, fast shipping, properly packaged, good price. 👌</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="9.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/02_01487_oKDAkxqCf97BNZSaNxuVgiAt/f800/1703950451.webp?s=01412ca5d479c8b354ba7ce4b54d15f6a7d9d16b" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">18.01.2026</div>
                        <div class="review-nick">@luft***</div>
                        <div class="review-text">Wszystko top :D</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="10.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://marketplace-web-assets.vinted.com/assets/no-photo/user-empty-state.svg" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">16.01.2026</div>
                        <div class="review-nick">@juli***</div>
                        <div class="review-text">Szybka wysyłka i sprzedający szybko odpowiadał na moje pytania, polecam😊</div>
                    </article>

                    <a class="review-card review-card-more" role="listitem" href="https://www.vinted.pl/member/91825259?tab=feedback" target="_blank" rel="noopener" title="Zobacz więcej opinii na Vinted">
                        <div class="review-more-icon" aria-hidden="true">↗️</div>
                        <div class="review-more-title"><span style="text-decoration: underline">Kliknij</span>, aby zobaczyć</div>
                        <div class="review-more-sub">więcej opinii na Vinted...</div>
                    </a>
                </div>
            </section>
            
            <div class="landing-toolbar" id="navSearchContainer">
                <div class="landing-toolbar-row">
                    <div class="landing-filters">
                        <div class="dropdown">
                            <button class="dropbtn"><span class="dropbtn-text">Kategorie</span><span class="arrow">▼</span></button>
                            <div class="dropdown-content" id="artistList">
                                <!-- Kategorie generowane dynamicznie -->
                            </div>
                        </div>
                        <input type="text" id="navSearchInput" class="nav-search-input" placeholder="🔎 Szukaj albumu...">
                    </div>

                    <div class="landing-actions">
                        <div class="dropdown sort-dropdown">
                            <button class="dropbtn"><span class="dropbtn-text">Sortuj wg</span><span class="arrow">▼</span></button>
                            <div class="dropdown-content" id="sortList">
                                <!-- Sortowanie generowane dynamicznie -->
                            </div>
                        </div>

                        <div class="view-controls">
                            <button class="view-toggle-btn" data-mode="default" title="Widok domyślny">☐</button>
                            <button class="view-toggle-btn" data-mode="compact" title="Widok kompaktowy">⊞</button>
                            <button class="view-toggle-btn" data-mode="list" title="Widok listy">☰</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="productsGrid" class="products-grid">
                <!-- Produkty zostaną wstawione tutaj przez JavaScript -->
            </div>
        `;

        app.innerHTML = html;

        // Reviews: keep the "last updated" label ticking.
        ensureReviewsLastUpdatedTicker();
        initReviewsScrollPosition();

        // Restore the search input value after re-render.
        // - If a category shortcut was used, `currentInputLabel` is the display label.
        // - Otherwise, keep the last typed term (used e.g. when re-rendering due to view/currency changes).
        const restoredSearch = (window.currentInputLabel ?? window.__searchTermCache ?? '');
        const landingSearchInputEl = document.getElementById('navSearchInput');
        if (landingSearchInputEl) {
            landingSearchInputEl.value = restoredSearch;
        }

        setNavSearchVisible(true);

        populateCategoryDropdown(products);

        const landingFilters = app.querySelector('.landing-filters');
        const landingToolbarRow = app.querySelector('.landing-toolbar-row');
        const landingSearchInput = document.getElementById('navSearchInput');
        if (landingFilters && landingSearchInput) {
            const setActive = (isActive) => {
                landingFilters.classList.toggle('search-active', Boolean(isActive));
                landingToolbarRow?.classList.toggle('search-active', Boolean(isActive));
            };

            landingSearchInput.addEventListener('focus', () => setActive(true));
            landingSearchInput.addEventListener('blur', () => setActive(false));
            landingSearchInput.addEventListener('input', () => setActive(true));
        }

        // Mobile/tablet: dropdowns should toggle on click (open/close).
        const isTouchLike = window.matchMedia ? window.matchMedia('(hover: none), (pointer: coarse)').matches : false;
        if (isTouchLike) {
            const dropdowns = Array.from(app.querySelectorAll('.landing-toolbar .dropdown'));

            const setOpen = (dropdownEl, isOpen) => {
                const btn = dropdownEl?.querySelector('.dropbtn');
                dropdownEl?.classList.toggle('is-open', Boolean(isOpen));
                if (btn) btn.setAttribute('aria-expanded', Boolean(isOpen) ? 'true' : 'false');
            };

            dropdowns.forEach((dropdownEl) => {
                const btn = dropdownEl.querySelector('.dropbtn');
                const content = dropdownEl.querySelector('.dropdown-content');
                if (!btn) return;

                btn.setAttribute('aria-haspopup', 'true');
                btn.setAttribute('aria-expanded', dropdownEl.classList.contains('is-open') ? 'true' : 'false');

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(dropdownEl, !dropdownEl.classList.contains('is-open'));
                });

                // Close when selecting an item.
                if (content) {
                    content.addEventListener('click', () => setOpen(dropdownEl, false));
                }
            });

            // Close when clicking outside; avoid accumulating listeners across re-renders.
            if (window.__landingDropdownOutsideHandler) {
                document.removeEventListener('click', window.__landingDropdownOutsideHandler, true);
            }
            window.__landingDropdownOutsideHandler = (e) => {
                const openDropdowns = document.querySelectorAll('.landing-toolbar .dropdown.is-open');
                if (!openDropdowns.length) return;
                openDropdowns.forEach((dropdownEl) => {
                    if (!dropdownEl.contains(e.target)) {
                        setOpen(dropdownEl, false);
                    }
                });
            };
            document.addEventListener('click', window.__landingDropdownOutsideHandler, true);
        }

        trackGaPageView();

        // 3. Logika filtrowania
        const productsGrid = document.getElementById('productsGrid');
        const viewBtns = document.querySelectorAll('.view-toggle-btn');

        // Hero Image Slider Logic (cross-fade)
        const heroImageA = document.getElementById('heroImageA');
        const heroImageB = document.getElementById('heroImageB');
        if (heroImageA && heroImageB) {
            const images = ['media/main1.png', 'media/main2.png'];
            let currentImageIndex = 0;
            let activeLayer = 'A';

            // Setup lightbox for hero images
            lightboxImages = images;

            const handleHeroClick = () => {
                openLightbox(currentImageIndex);
            };
            heroImageA.addEventListener('click', handleHeroClick);
            heroImageB.addEventListener('click', handleHeroClick);

            const applyTilt = (imgEl, index) => {
                imgEl.classList.remove('tilt-left', 'tilt-right');
                imgEl.classList.add(index === 1 ? 'tilt-right' : 'tilt-left');
            };

            // Initialize
            heroImageA.src = images[0];
            heroImageB.src = images[0];
            heroImageA.classList.add('active');
            heroImageB.classList.remove('active');
            applyTilt(heroImageA, 0);
            applyTilt(heroImageB, 0);

            const showHeroIndex = (nextIndex) => {
                const incoming = activeLayer === 'A' ? heroImageB : heroImageA;
                const outgoing = activeLayer === 'A' ? heroImageA : heroImageB;
                const newSrc = images[nextIndex];

                // Preload to avoid flashing
                const tempImg = new Image();
                tempImg.onload = () => {
                    incoming.src = newSrc;
                    applyTilt(incoming, nextIndex);

                    incoming.classList.add('active');
                    outgoing.classList.remove('active');

                    activeLayer = activeLayer === 'A' ? 'B' : 'A';
                    currentImageIndex = nextIndex;
                };
                tempImg.src = newSrc;
            };

            // Automatic slideshow
            setInterval(() => {
                const nextIndex = (currentImageIndex + 1) % images.length;
                showHeroIndex(nextIndex);
            }, 5000);
        }

        // Obsługa przełączania widoku
        if (viewBtns.length > 0) {
            const savedMode = localStorage.getItem('productsViewMode');
            const isDesktop = window.matchMedia && window.matchMedia('(min-width: 992px)').matches;
            const defaultMode = isDesktop ? 'compact' : 'default';
            let currentMode = savedMode || defaultMode;
            const modes = ['default', 'compact', 'list'];
            if (!modes.includes(currentMode)) currentMode = defaultMode;

            const updateView = (mode, { persist = true } = {}) => {
                // Reset classes
                productsGrid.classList.remove('compact', 'list-view');
                
                // Apply current mode class
                if (mode === 'compact') productsGrid.classList.add('compact');
                if (mode === 'list') productsGrid.classList.add('list-view');
                
                // Update buttons active state
                viewBtns.forEach(btn => {
                    if (btn.dataset.mode === mode) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                if (persist) {
                    localStorage.setItem('productsViewMode', mode);
                }
                currentMode = mode;
            };

            // Initial render
            updateView(currentMode, { persist: Boolean(savedMode) });

            viewBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    updateView(btn.dataset.mode, { persist: true });
                });
            });
        }

        const navSearchInput = document.getElementById('navSearchInput');

        let searchTerm = navSearchInput ? navSearchInput.value : '';

        const escapeHtml = (s) => String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const getPrimaryGenre = (product) => {
            if (!product || product.isCustom) return '';
            const g = product.genre;
            if (!g) return '';
            if (Array.isArray(g)) return String(g.find(Boolean) || '').trim();
            return String(g).trim();
        };

        const normalizeKey = (s) => String(s || '')
            .toLocaleLowerCase('pl')
            .replace(/[^ -\p{L}\p{N}]+/gu, '')
            .trim();

        const firstLetter = (s) => {
            // Group label should be based on the FIRST non-whitespace character (can be a digit/symbol).
            // If it's a letter, we uppercase it for nicer grouping.
            const raw = String(s || '');
            const trimmed = raw.trimStart();
            if (!trimmed) return '#';

            const ch = Array.from(trimmed)[0];
            if (!ch) return '#';

            const upper = ch.toLocaleUpperCase('pl');
            const lower = ch.toLocaleLowerCase('pl');
            return upper !== lower ? upper : ch;
        };

        const comparePl = (a, b) => String(a || '').localeCompare(String(b || ''), 'pl', { sensitivity: 'base' });

        const applySort = (list) => {
            const mode = window.currentSortMode || 'NONE';
            if (mode === 'NONE') return list;
            const dir = mode.endsWith('_DESC') ? -1 : 1;
            const byArtist = mode.startsWith('ARTIST_');
            const byAlbum = mode.startsWith('ALBUM_');
            const byGenre = mode.startsWith('GENRE_');

            const customs = list.filter(p => p.isCustom);
            const others = list.filter(p => !p.isCustom);

            others.sort((pa, pb) => {
                let ka = '';
                let kb = '';
                if (byArtist) {
                    ka = pa.artist;
                    kb = pb.artist;
                } else if (byAlbum) {
                    ka = pa.album;
                    kb = pb.album;
                } else if (byGenre) {
                    ka = getPrimaryGenre(pa);
                    kb = getPrimaryGenre(pb);
                }

                const primary = comparePl(ka, kb) * dir;
                if (primary !== 0) return primary;
                // Stable-ish fallback
                return comparePl(pa.name, pb.name) * dir;
            });

            return [...customs, ...others];
        };

        function filterAndRender() {
            const filtered = products.filter(p => {
                // Customowy zawsze widoczny
                if (p.isCustom) return true;

                const filterType = window.currentCategoryFilter || 'ALL';
                const filterValue = window.currentCategoryValue;
                
                // Determine if product matches the category filter
                let matchesCategory = true;

                const extractGenres = (product) => {
                    if (!product || product.isCustom) return [];
                    const g = product.genre;
                    if (!g) return [];
                    if (Array.isArray(g)) return g.filter(Boolean).map(x => String(x).trim()).filter(Boolean);
                    return [String(g).trim()].filter(Boolean);
                };

                const extractArtists = (product) => {
                    if (!product || product.isCustom) return [];
                    const a = product.artist;
                    if (!a || a === 'Custom') return [];
                    return String(a)
                        .split('&')
                        .map(x => String(x).trim())
                        .filter(Boolean);
                };
                
                if (filterType === 'POLISH') {
                    matchesCategory = p.isPolish === true;
                } else if (filterType === 'FOREIGN') {
                    matchesCategory = p.isPolish === false;
                } else if (filterType === 'GENRE') {
                    matchesCategory = extractGenres(p).includes(filterValue);
                } else if (filterType === 'ARTIST') {
                    matchesCategory = extractArtists(p).includes(filterValue);
                }

                // Wyszukiwanie po nazwie (name) lub artyście
                let term = searchTerm.toLowerCase();

                const normalizeKey = (s) => String(s || '')
                    .toLocaleLowerCase('pl')
                    .replace(/[^\p{L}\p{N}]+/gu, '');

                const termKey = normalizeKey(term);
                
                // Ignore search term if it matches the current category label (display only)
                if (window.currentInputLabel && term === window.currentInputLabel.toLowerCase()) {
                    term = '';
                }

                const matchesSpecialSearch = (() => {
                    // Allow typing the same terms as the category shortcuts.
                    if (!termKey) return true;
                    if (termKey.startsWith('polsk')) return p.isPolish === true;
                    if (termKey.startsWith('zagraniczn')) return p.isPolish === false;
                    if (termKey.startsWith('wszystk')) return true;
                    return null;
                })();

                const matchesGenreSearch = (() => {
                    if (!termKey) return true;
                    return extractGenres(p).some(g => normalizeKey(g) === termKey);
                })();

                const matchesTextSearch =
                    p.name.toLowerCase().includes(term) ||
                    p.artist.toLowerCase().includes(term) ||
                    extractArtists(p).some(a => a.toLowerCase().includes(term));

                const matchesSearch =
                    (matchesSpecialSearch !== null ? matchesSpecialSearch : false) ||
                    matchesGenreSearch ||
                    matchesTextSearch;
                
                return matchesCategory && matchesSearch;
            });

            const sorted = applySort(filtered);
            renderGrid(sorted, window.currentSortMode || 'NONE');
        }

        // Attach listener to nav search input if not already attached (or re-attach logic specific to this view)
        // Since navSearchInput is global, we can just update the local searchTerm variable
        if (navSearchInput) {
            // Remove old listeners to avoid duplicates if we re-render landing page?
            // Actually, the global listener updates the input value.
            // We need to listen to input changes here to update the grid.
            
            // Define the handler
            const handleInput = (e) => {
                searchTerm = e.target.value;

                // Keep last typed value for future re-renders.
                window.__searchTermCache = searchTerm;

                // Jeśli użytkownik zmienia tekst w wyszukiwarce, resetujemy filtr kategorii na ALL,
                // chyba że tekst nadal pasuje do etykiety (co jest mało prawdopodobne przy pisaniu, ale możliwe przy wklejaniu)
                // Dzięki temu edycja tekstu "Polskie albumy" na "Polskie" spowoduje wyszukanie frazy "Polskie" we wszystkich produktach,
                // a wyczyszczenie pola spowoduje pokazanie wszystkich produktów.
                if (window.currentInputLabel && searchTerm !== window.currentInputLabel) {
                    window.currentCategoryFilter = 'ALL';
                    window.currentCategoryValue = null;
                    window.currentInputLabel = null;
                }

                filterAndRender();
            };
            
            // Cleanup when leaving this view? 
            // Since it's a SPA and we overwrite app.innerHTML, this function scope will be garbage collected,
            // BUT the event listener on navSearchInput (which is outside app) will persist and keep a reference to handleInput!
            // This is a memory leak and logic bug (multiple listeners accumulating).
            
            // Fix: We should probably have a single global listener that calls a "currentPageFilterFunction" if it exists.
            // OR: We remove the listener when we navigate away.
            // For now, let's use a simple property on the element to store the current handler and remove it.
            
            if (navSearchInput.currentHandler) {
                navSearchInput.removeEventListener('input', navSearchInput.currentHandler);
            }
            navSearchInput.currentHandler = handleInput;
            navSearchInput.addEventListener('input', handleInput);
        }

        const getGroupLabel = (product, mode) => {
            if (!product) return '#';
            if (product.isCustom) return 'NA ZAMÓWIENIE';
            if (mode === 'ARTIST_ASC' || mode === 'ARTIST_DESC') return firstLetter(product.artist);
            if (mode === 'ALBUM_ASC' || mode === 'ALBUM_DESC') return firstLetter(product.album);
            if (mode === 'GENRE_ASC' || mode === 'GENRE_DESC') {
                const g = getPrimaryGenre(product);
                return g || 'INNE';
            }
            return '#';
        };

        const renderGroupHeader = (label, count) => {
            const safe = escapeHtml(label);
            const safeCount = Number.isFinite(count) ? count : null;
            const suffix = safeCount !== null ? ` <span class="grid-group-count">(${safeCount})</span>` : '';
            return `
                <div class="grid-group-header" aria-hidden="true">
                    <span class="grid-group-title">${safe}${suffix}</span>
                    <span class="grid-group-line"></span>
                </div>
            `;
        };

        function renderGrid(filteredProducts, sortMode = 'NONE') {
            if (filteredProducts.length === 0) {
                productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--muted-text-color); padding: 40px;">Nie znaleziono produktów spełniających kryteria.</p>';
                return;
            }

            let gridHtml = '';

            const renderCard = (product) => {
                // Use promoPrice if available, otherwise price
                const displayPrice = product.promoPrice || product.price;
                const oldPricePln = product.isCustom ? 50.0 : 45.0;
                const image1 = product.images && product.images.length > 0 ? product.images[0] : 'https://placehold.co/600x600?text=No+Image';
                const image2 = product.images && product.images.length > 1 ? product.images[1] : image1;
                
                const isCustom = product.isCustom ? 'custom-card' : '';
                const customLabel = product.isCustom ? '<div class="custom-label">NA ZAMÓWIENIE</div>' : '';

                const cardTitleHtml = product.isCustom
                    ? product.name
                    : `${product.artist}<br><span class="card-album">„${product.album}”</span>`;

                gridHtml += `
                    <a href="index.html?id=${product.id}" class="product-card ${isCustom}">
                        ${customLabel}
                        <div class="card-image-container">
                            <img src="${image1}" alt="${product.name}" class="card-image card-image-main" loading="lazy" decoding="async" fetchpriority="low">
                            <img src="${image2}" alt="${product.name} - widok 2" class="card-image card-image-hover" loading="lazy" decoding="async" fetchpriority="low">
                        </div>
                        <div class="card-content">
                            <h3 class="card-title">${cardTitleHtml}</h3>
                            <p class="card-price">${formatMoneyInline(displayPrice)} <span class="old-price">${formatMoneyInline(oldPricePln)}</span></p>
                        </div>
                    </a>
                `;
            };

            if (sortMode && sortMode !== 'NONE') {
                const customs = filteredProducts.filter(p => p.isCustom);
                const others = filteredProducts.filter(p => !p.isCustom);

                const groupCounts = new Map();
                others.forEach((product) => {
                    const group = getGroupLabel(product, sortMode);
                    groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
                });

                if (customs.length) {
                    gridHtml += renderGroupHeader('NA ZAMÓWIENIE', customs.length);
                    customs.forEach(renderCard);
                }

                let lastGroup = null;
                others.forEach(product => {
                    const group = getGroupLabel(product, sortMode);
                    if (group !== lastGroup) {
                        gridHtml += renderGroupHeader(group, groupCounts.get(group) || 0);
                        lastGroup = group;
                    }
                    renderCard(product);
                });
            } else {
                gridHtml += renderGroupHeader('WSZYSTKIE', filteredProducts.length);
                filteredProducts.forEach(renderCard);
            }

            productsGrid.innerHTML = gridHtml;
        }

        // Event Listeners
        // searchInput removed from DOM, logic moved to navSearchInput above

        // Sort dropdown options
        const sortList = document.getElementById('sortList');
        if (sortList) {
            const renderSortOptions = () => {
                sortList.innerHTML = '';
                const current = window.currentSortMode || 'NONE';
                SORT_OPTIONS.forEach((opt) => {
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = opt.label;
                    link.classList.toggle('is-selected', opt.key === current);
                    link.onclick = (e) => {
                        e.preventDefault();
                        window.currentSortMode = opt.key;
                        renderSortOptions();
                        filterAndRender();
                    };
                    sortList.appendChild(link);
                });
            };
            renderSortOptions();
        }

        // Pierwsze renderowanie
        filterAndRender();
    }

    // Funkcja renderująca szczegóły produktu
    function renderProductDetail(id, products) {
        setNavSearchVisible(false);

        const product = products.find(p => p.id === id);

        if (!product) {
            app.innerHTML = `
                <div style="text-align:center; padding: 50px;">
                    <h2>Nie znaleziono produktu :(</h2>
                    <a href="/" class="btn-buy btn-vinted" style="margin-top:20px; display:inline-block; width:auto;">Wróć do sklepu</a>
                </div>
            `;
            return;
        }

        // Zaktualizuj tytuł strony
        document.title = `${product.name} - FajneBreloki.pl`;

        // Set global lightbox images
        lightboxImages = product.images || [];
        lightboxIndex = 0;

        // Determine prices (stored in PLN; formatted according to selected currency)
        const vintedPricePln = product.promoPrice ? product.promoPrice : product.price;
        const standardPricePln = product.price;
        const oldPricePln = product.isCustom ? 50.0 : 45.0;
        
        const image1 = product.images && product.images.length > 0 ? product.images[0] : 'https://placehold.co/600x600?text=No+Image';
        
        let thumbnailsHtml = '';
        if (product.images && product.images.length > 1) {
            thumbnailsHtml = `
                <div class="detail-thumbnails">
                    ${product.images.map((img, index) => {
                        const label = index === 0 ? "Okładka" : "Wnętrze";
                        return `
                        <div class="thumbnail-wrapper" onclick="changeMainImage(this, '${img}', ${index})">
                            <img src="${img}" class="thumbnail ${index === 0 ? 'active' : ''}" alt="${label}" loading="lazy" decoding="async">
                            <span class="thumbnail-label">${label}</span>
                        </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Renderowanie sekcji zakupu (przyciski lub formularz)
        let buySection = '';
        let formSection = '';
        
        if (product.isCustom) {
            formSection = `
                <div class="custom-order-form full-width">
                    <h3>ZAMÓW SWÓJ</h3>
                    <h2 style="margin-top:-12px">UNIKALNY BRELOK✨</h2>
                    <p style="margin-bottom: 20px; font-size: 0.9rem;">✏️ Wypełnij formularz, a skontaktuję się z Tobą w celu ustalenia szczegółów.</p>
                    
                    <form id="customOrderForm" action="https://formspree.io/f/mldyelez" method="POST">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="name">Imię</label>
                                <input type="text" id="name" name="name" required placeholder="Twoje imię">
                            </div>
                            
                            <div class="form-group">
                                <label for="email">Email</label>
                                <input type="email" id="email" name="email" required placeholder="twoj@email.com">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="platform">Gdzie preferujesz zakup?</label>
                                <select id="platform" name="platform">
                                    <option value="vinted">Vinted (${formatMoneyInline(product.promoPrice || product.price)} - Najtaniej!)</option>
                                    <option value="olx">OLX (${formatMoneyInline(product.price)})</option>
                                    <option value="allegro">Allegro Lokalnie (${formatMoneyInline(product.price)})</option>
                                </select>
                            </div>

                            <div class="form-group tooltip-container">
                                <label for="music_platform">Platforma streamingowa ℹ️</label>
                                <select id="music_platform" name="music_platform">
                                    <option value="spotify">Spotify (Domyślne)</option>
                                    <option value="apple_music">Apple Music</option>
                                    <option value="youtube_music">YouTube Music</option>
                                    <option value="tidal">Tidal</option>
                                    <option value="other">Inna (napisz niżej)</option>
                                </select>
                                <span class="tooltip-text">Wybierz aplikację, w której ma się otwierać album po zbliżeniu telefonu do breloka.</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="album">Jaki album Cię interesuje?</label>
                            <input type="text" id="album" name="album" required placeholder="np. The Weeknd - After Hours">
                        </div>

                        <div class="form-group">
                            <label for="details">Dodatkowe informacje (opcjonalne)</label>
                            <textarea id="details" style="height: 100px;" name="details" rows="2" placeholder="np. link do konkretnej playlisty lub inne uwagi / zapytanie o brelok ze swoją grafiką..."></textarea>
                        </div>

                        <button type="submit" class="btn-submit">WYŚLIJ ZAPYTANIE ➤</button>
                    </form>
                    <p style="margin-top: 10px; font-size: 0.8rem; color: #888;">
                        * To zapytanie jest niezobowiązujące. Odpiszę najszybciej jak to możliwe!
                    </p>
                </div>
            `;
        } else {
            buySection = `
                <div class="buy-buttons">
                    <a href="${product.vintedUrl}" title="Kliknij, aby przejść na Vinted" target="_blank" rel="noopener noreferrer" class="btn-buy btn-vinted">
                        <span>KUP TERAZ NA VINTED</span>
                        <span class="price-tag">${formatMoneyInline(vintedPricePln)}</span>
                    </a>
                    
                    <a href="${product.olxUrl}" title="Kliknij, aby przejść na OLX" target="_blank" rel="noopener noreferrer" class="btn-buy btn-olx">
                        <span>KUP TERAZ NA OLX</span>
                        <span class="price-tag">${formatMoneyInline(standardPricePln)}</span>
                    </a>

                    <a href="${product.allegroUrl}" title="Kliknij, aby przejść na Allegro Lokalnie" target="_blank" rel="noopener noreferrer" class="btn-buy btn-allegro">
                        <span>KUP TERAZ NA <br class="mobile-break">ALLEGRO LOKALNIE</span>
                        <span class="price-tag">${formatMoneyInline(standardPricePln)}</span>
                    </a>
                </div>
            `;
        }

        const descriptionHtml = renderDescriptionWithLineGaps(
            product.description || `Ręcznie wykonany brelok z okładką albumu **${product.album}** artysty **${product.artist}**. Wyposażony w chip NFC, który po zbliżeniu telefonu otwiera album w Spotify.`
        );

        const detailTitleHtml = product.isCustom
            ? `<span class="detail-artist">${product.name}</span>`
            : `<span class="detail-artist">${product.artist}</span><br><span class="detail-album">„${product.album}”</span>`;

        const html = `
            <a href="index.html" class="back-link">← Wróć do strony głównej</a>
            <div class="product-detail-container">
                <div class="product-detail">
                    <div class="detail-image">
                        <img id="mainImage" src="${image1}" alt="${product.name}" onclick="openLightbox(lightboxIndex)" style="cursor: zoom-in;" decoding="async" loading="eager" fetchpriority="high">
                        ${thumbnailsHtml}
                    </div>
                    <div class="detail-info">
                        <h1 class="detail-heading">
                            <strong class="detail-kicker">Brelok CD z NFC💥</strong>
                            <span class="detail-title">${detailTitleHtml}</span>
                        </h1>
                        <p class="detail-price">${formatMoneyInline(vintedPricePln)} <span class="old-price">${formatMoneyInline(oldPricePln)}</span></p>
                        <div class="detail-desc">${descriptionHtml}</div>
                        
                        ${buySection}
                    </div>
                </div>
                ${formSection}
            </div>
        `;

        app.innerHTML = html;

        // Handle form submission with AJAX
        const form = document.getElementById('customOrderForm');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                const btn = form.querySelector('.btn-submit');
                const originalText = btn.innerText;
                btn.innerText = 'WYSYŁANIE...';
                btn.disabled = true;

                const formData = new FormData(form);

                fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                }).then(response => {
                    if (response.ok) {
                        form.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px;">
                                <div style="font-size: 3rem; margin-bottom: 20px;">✅</div>
                                <h3 style="color: #0f5132; margin-bottom: 10px;">Wiadomość wysłana!</h3>
                                <p>Dzięki za zainteresowanie. Odezwę się do Ciebie mailowo najszybciej jak to możliwe!</p>
                                <button onclick="location.reload()" class="btn-buy btn-vinted no-badge" style="margin-top: 20px; width: auto; display: inline-block; font-size: 0.9rem;">Wróć do sklepu</button>
                            </div>
                        `;
                    } else {
                        alert('Wystąpił błąd przy wysyłaniu formularza. Spróbuj ponownie później.');
                        btn.innerText = originalText;
                        btn.disabled = false;
                    }
                }).catch(error => {
                    console.error('Error:', error);
                    alert('Wystąpił błąd przy wysyłaniu formularza. Spróbuj ponownie później.');
                    btn.innerText = originalText;
                    btn.disabled = false;
                });
            });
        }
    }

    // Funkcja renderująca stronę wysyłki
    function renderShippingPage() {
        setNavSearchVisible(false);

        document.title = 'Wysyłka - FajneBreloki.pl';
        app.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="text-align: center; margin: 0 20px 40px; line-height: 1.2;">Informacje o wysyłce 📦</h1>
                
                <div class="shipping-info-box" style="margin-bottom: 50px; text-align: center; padding: 20px; background: var(--callout-bg); border-radius: 15px; border: 1px solid var(--callout-border); max-width: 550px; margin-left: auto; margin-right: auto;">
                    <h3 style="color: var(--callout-title-color); margin-bottom: 15px;">⏱️ Czas realizacji</h3>
                    <p style="font-size: 1.1rem; line-height: 1.3; margin-bottom: 10px;"><strong>Standardowe breloki:</strong> wysyłka w 24h</p>
                    <p style="font-size: 1.1rem; line-height: 1.3; margin-bottom: 12px;"><strong>Breloki customowe:</strong> wysyłka do 48h</p>
                    
                    <div style="border-top: 1px solid var(--callout-border); margin: 12px; padding-top: 15px;">
                        <p style="font-size: 1.1rem; line-height: 1.2;"><strong>📍Odbiór osobisty:</strong> Wrocław</p>
                        <p style="font-size: 0.9rem; line-height: 1; color: var(--muted-text-color)">(po wcześniejszym umówieniu)</p>
                    </div>
                </div>

                <div class="pricing-table">
                    <!-- Vinted -->
                    <div class="pricing-card popular">
                        <div class="pricing-header" style="background: #007782;">
                            <div class="popular-badge">NAJTANIEJ!</div>
                            <h3>Vinted</h3>
                            <p>Największy wybór przewoźników</p>
                        </div>
                        <ul class="pricing-features">
                            <li>✅ InPost Kurier & Paczkomat</li>
                            <li>✅ Poczta Polska MiniPaczka</li>
                            <li>✅ ORLEN Paczka</li>
                            <li>✅ DPD Kurier & Paczkomat</li>
                            <li>✅ DHL Kurier & Paczkomat</li>
                            <li>✅ UPS Kurier & Paczkomat</li>
                            <li>✅ GLS Kurier & Paczkomat</li>
                            <li>✅ Pocztex Kurier & Paczkomat</li>
                        </ul>
                    </div>

                    <!-- OLX -->
                    <div class="pricing-card">
                        <div class="pricing-header" style="background: #002f34;">
                            <h3>OLX</h3>
                            <p>Popularna alternatywa</p>
                        </div>
                        <ul class="pricing-features">
                            <li>✅ InPost Paczkomat</li>
                            <li>✅ Poczta Polska MiniPaczka</li>
                            <li>✅ ORLEN Paczka</li>
                            <li>✅ DPD Kurier</li>
                            <li class="disabled">❌ DHL, UPS, GLS, Pocztex</li>
                        </ul>
                    </div>

                    <!-- Allegro -->
                    <div class="pricing-card">
                        <div class="pricing-header" style="background: #ff5a00;">
                            <h3>Allegro Lokalnie</h3>
                            <p><strong>Darmowa wysyłka</strong> od 45zł<br/> z <u>pakietem Smart</u></li></p>
                        </div>
                        <ul class="pricing-features">
                            <li>✅ InPost Kurier & Paczkomat<br/>
                            
                            <li class="disabled">❌ Pozostali przewoźnicy</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        trackGaPageView();

        trackGaPageView();
    }

    // Funkcja renderująca stronę FAQ
    function renderFaqPage() {
        setNavSearchVisible(false);

        document.title = 'FAQ - FajneBreloki.pl';
        app.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto;">
                <h1 style="text-align: center; line-height: 1.2; padding: 40px 0 20px; font-size: 2em;">Jak to działa? 🤔</h1>
                
                <div class="how-it-works-steps">
                    <div class="step-card">
                        <div class="step-icon">💿</div>
                        <h3>1. Wybierz album</h3>
                        <p>Znajdź swój ulubiony album w sklepie lub zamów własny projekt.</p>
                    </div>
                    <div class="step-card">
                        <div class="step-icon">📲</div>
                        <h3>2. Zbliż telefon</h3>
                        <p>Przyłóż górną krawędź telefonu (iPhone) lub środek tyłu (Android) do breloka.</p>
                    </div>
                    <div class="step-card">
                        <div class="step-icon">🎧</div>
                        <h3>3. Słuchaj muzyki</h3>
                        <p>Kliknij powiadomienie, które pojawi się na ekranie. Album otworzy się automatycznie!</p>
                    </div>
                </div>

                <h2 style="text-align: center; line-height: 1.2; padding-bottom: 20px; font-size: 2em;">Częste pytania (FAQ)</h2>

                <div class="faq-container">
                    <details class="faq-item">
                        <summary>Czy w zestawie jest płyta CD?</summary>
                        <p>Nie, jest to mały brelok imitujący płytę CD (o wymiarach 5cm×4.5cm×0.8cm). Nie zawiera on prawdziwej płyty z muzyką, a jedynie chip NFC, który po zbliżeniu do telefonu otwiera album w aplikacji streamingowej (np. Spotify).</p>
                    </details>

                    <details class="faq-item">
                        <summary>Czy brelok działa z każdym telefonem?</summary>
                        <p>Brelok działa z każdym smartfonem wyposażonym w moduł NFC. Większość telefonów wyprodukowanych po 2018 roku posiada tę funkcję (m.in. wszystkie iPhone'y od modelu XS/XR w górę oraz większość Androidów).</p>
                    </details>

                    <details class="faq-item">
                        <summary>Czy muszę instalować specjalną aplikację?</summary>
                        <p>Nie! Wystarczy, że masz zainstalowaną aplikację Spotify (lub inną wybraną, np. Apple Music). Telefon sam rozpozna brelok i zaproponuje otwarcie albumu.</p>
                    </details>

                    <details class="faq-item">
                        <summary>Zimą NFC czasem nie działa od razu — co zrobić?</summary>
                        <p>W niskiej temperaturze (np. po dostawie lub gdy brelok był na mrozie) NFC może zadziałać z opóźnieniem. Daj brelokowi się ogrzać do temperatury pokojowej i spróbuj ponownie po kilku godzinach — zwykle to rozwiązuje problem.</p>
                    </details>

                    <details class="faq-item">
                        <summary>Czy brelok wymaga baterii lub ładowania?</summary>
                        <p>Nie. Chip NFC wewnątrz breloka jest pasywny – zasilany jest energią z pola magnetycznego Twojego telefonu w momencie zbliżenia. Będzie działał wiecznie!</p>
                    </details>

                    <details class="faq-item">
                        <summary>Czy mogę zmienić album przypisany do breloka?</summary>
                        <p>Domyślnie breloki są zabezpieczone przed nadpisaniem, aby nikt przypadkowo nie usunął zawartości. Jeśli jednak chcesz mieć możliwość zmiany albumu w przyszłości, napisz o tym w wiadomości przy zamówieniu – zostawię go odblokowanego!</p>
                    </details>

                    <details class="faq-item">
                        <summary>Czy brelok działa przez etui?</summary>
                        <p>Tak, sygnał NFC przenika przez większość standardowych etui (silikonowe, plastikowe, skórzane). Problemy mogą występować jedynie przy bardzo grubych, pancernych obudowach lub tych wykonanych z metalu.</p>
                    </details>

                    <details class="faq-item">
                        <summary>Ile czasu trwa realizacja zamówienia?</summary>
                        <p>Breloki dostępne "od ręki" wysyłam zazwyczaj w ciągu 24h. Zamówienia personalizowane (custom) realizuję w ciągu 1-3 dni roboczych.</p>
                    </details>
                </div>
                
                <div style="text-align: center; margin-top: 50px;">
                    <p>Masz inne pytanie?</p>
                    <a href="index.html?page=contact" class="btn-buy btn-vinted no-badge" style="display: inline-block; width: auto; margin-top: 10px; font-size: 1rem;">Napisz do mnie!</a>
                </div>
            </div>
        `;

        trackGaPageView();
    }

    function renderPrivacyPage() {
        setNavSearchVisible(false);

        document.title = 'Polityka Prywatności - FajneBreloki.pl';
        app.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6;">
                <h1 style="text-align: center; margin-bottom: 40px;">Polityka Prywatności</h1>
                
                <section style="margin-bottom: 30px;">
                    <h2>1. Informacje ogólne</h2>
                    <p>Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych przekazanych przez Użytkowników w związku z korzystaniem ze strony internetowej FajneBreloki.pl.</p>
                    <p>Administratorem danych osobowych jest właściciel serwisu FajneBreloki.pl. Kontakt: <a href="mailto:kamiljama@gmail.com" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">kamiljama@gmail.com</a>.</p>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>2. Jakie dane zbieramy?</h2>
                    <p>Podczas korzystania z naszej strony możemy zbierać następujące dane:</p>
                    <ul style="list-style-type: disc; margin-left: 20px; margin-top: 10px;">
                        <li><strong>Dane kontaktowe:</strong> adres e-mail oraz treść wiadomości (gdy kontaktujesz się z nami e-mailem lub przez wskazane kanały kontaktu).</li>
                        <li><strong>Dane techniczne:</strong> informacje o urządzeniu i przeglądarce, przybliżona lokalizacja, źródło wejścia, odsłony i sposób korzystania ze strony (dane analityczne).</li>
                        <li><strong>Dane o preferencjach:</strong> informacje o preferencjach wyświetlania strony (np. tryb jasny/ciemny) zapisywane w pamięci przeglądarki (LocalStorage).</li>
                    </ul>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>3. Cel przetwarzania danych</h2>
                    <p>Twoje dane przetwarzane są wyłącznie w celu:</p>
                    <ul style="list-style-type: disc; margin-left: 20px; margin-top: 10px;">
                        <li>Udzielenia odpowiedzi na przesłane zapytania.</li>
                        <li>Realizacji zamówień (w przypadku kontaktu bezpośredniego).</li>
                        <li>Zapewnienia prawidłowego działania strony (np. zapamiętanie wybranego motywu).</li>
                        <li>Prowadzenia statystyk i analizy ruchu na stronie, aby ulepszać serwis i treści.</li>
                    </ul>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>4. Narzędzia analityczne (Google Analytics 4)</h2>
                    <p>Na stronie korzystamy z narzędzia analitycznego <strong>Google Analytics 4</strong>, które pomaga nam zrozumieć, jak Użytkownicy korzystają z serwisu (np. które podstrony są najczęściej odwiedzane, z jakich urządzeń i źródeł ruchu).</p>
                    <p>Dostawcą usługi jest co do zasady <strong>Google Ireland Limited</strong> (a w ramach grupy Google dane mogą być przetwarzane również przez <strong>Google LLC</strong>).</p>
                    <p>W ramach analityki mogą być przetwarzane dane techniczne, takie jak identyfikatory online (np. pliki cookies), przybliżona lokalizacja, typ urządzenia, przeglądarka, adresy URL, informacje o interakcjach oraz czas wizyt.</p>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>5. Pliki cookies i LocalStorage</h2>
                    <p>Strona może wykorzystywać pliki <strong>cookies</strong> związane z działaniem narzędzi analitycznych (Google Analytics 4). Możesz ograniczyć lub zablokować cookies w ustawieniach swojej przeglądarki albo korzystać z dodatków blokujących śledzenie (np. uBlock Origin).</p>
                    <p>Wykorzystujemy również mechanizm <strong>LocalStorage</strong> do zapamiętania Twoich preferencji dotyczących wyglądu strony (tryb jasny/ciemny). Dane te są przechowywane na Twoim urządzeniu.</p>
                    <p>Więcej informacji o tym, jak Google przetwarza dane: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">policies.google.com/privacy</a>.</p>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>6. Udostępnianie danych</h2>
                    <p>Twoje dane nie są sprzedawane. Mogą być udostępniane podmiotom trzecim wyłącznie wtedy, gdy jest to niezbędne do działania strony lub realizacji zamówienia, w szczególności:</p>
                    <ul style="list-style-type: disc; margin-left: 20px; margin-top: 10px;">
                        <li>dostawcom usług analitycznych (Google Analytics 4 / Google),</li>
                        <li>platformom sprzedażowym i usługom, z których korzystasz przy zakupie (np. Vinted/OLX/Allegro),</li>
                        <li>podmiotom obsługującym wysyłkę (np. firmy kurierskie) – w zakresie niezbędnym do realizacji zamówienia,</li>
                        <li>organom publicznym – jeśli wymagają tego przepisy prawa.</li>
                    </ul>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>7. Przekazywanie danych poza EOG</h2>
                    <p>W związku z korzystaniem z usług Google, dane mogą być przekazywane do państw poza Europejski Obszar Gospodarczy (np. do USA). Google stosuje mechanizmy prawne przewidziane przez przepisy ochrony danych (np. standardowe klauzule umowne), aby zapewnić odpowiedni poziom ochrony.</p>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>8. Okres przechowywania danych</h2>
                    <p>Dane kontaktowe przechowujemy przez czas potrzebny do obsługi korespondencji oraz ewentualnych roszczeń. Dane analityczne w Google Analytics 4 są przechowywane zgodnie z konfiguracją ustawień retencji w GA4.</p>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>9. Twoje prawa</h2>
                    <p>Masz prawo do wglądu w swoje dane, ich sprostowania, żądania usunięcia lub ograniczenia przetwarzania, a także prawo wniesienia sprzeciwu – w granicach przewidzianych przepisami.</p>
                    <p>W sprawach związanych z ochroną danych skontaktuj się z nami: <a href="mailto:kamiljama@gmail.com" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">kamiljama@gmail.com</a>. Masz również prawo złożyć skargę do Prezesa UODO.</p>
                </section>

                <section style="margin-bottom: 30px;">
                    <h2>10. Zmiany w polityce</h2>
                    <p>Możemy aktualizować niniejszą Politykę Prywatności w razie zmian na stronie lub w przepisach. Ostatnia aktualizacja: 05.01.2026.</p>
                </section>

                <div style="text-align: center; margin-top: 50px;">
                    <a href="index.html" class="btn-buy btn-vinted no-badge" style="display: inline-block; width: auto; font-size: 1rem;">Wróć do strony głównej</a>
                </div>
            </div>
        `;

        trackGaPageView();
    }
});

// Global variables for lightbox
let lightboxImages = [];
let lightboxIndex = 0;

// Global function to change image
function changeMainImage(wrapper, src, index) {
    document.getElementById('mainImage').src = src;
    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
    wrapper.querySelector('.thumbnail').classList.add('active');
    if (typeof index !== 'undefined') lightboxIndex = index;
}

// Lightbox functions
function openLightbox(index) {
    if (typeof index !== 'undefined') lightboxIndex = index;

    // Create lightbox element if it doesn't exist
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox';
        lightbox.className = 'lightbox';
        lightbox.onclick = (e) => {
            if (e.target === lightbox) closeLightbox();
        };
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
                <div class="lightbox-nav prev" onclick="prevLightboxImage()">&#10094;</div>
                <img id="lightboxImage" src="" decoding="async">
                <div class="lightbox-nav next" onclick="nextLightboxImage()">&#10095;</div>
            </div>
        `;
        document.body.appendChild(lightbox);
    }
    
    updateLightboxImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function updateLightboxImage() {
    const img = document.getElementById('lightboxImage');
    const prevBtn = document.querySelector('.lightbox-nav.prev');
    const nextBtn = document.querySelector('.lightbox-nav.next');
    
    if (lightboxImages.length > 0) {
        img.src = lightboxImages[lightboxIndex];
    }
    
    // Show/hide arrows
    if (lightboxIndex > 0) {
        prevBtn.style.display = 'flex';
    } else {
        prevBtn.style.display = 'none';
    }
    
    if (lightboxIndex < lightboxImages.length - 1) {
        nextBtn.style.display = 'flex';
    } else {
        nextBtn.style.display = 'none';
    }
}

function nextLightboxImage() {
    if (lightboxIndex < lightboxImages.length - 1) {
        lightboxIndex++;
        updateLightboxImage();
    }
    event.stopPropagation();
}

function prevLightboxImage() {
    if (lightboxIndex > 0) {
        lightboxIndex--;
        updateLightboxImage();
    }
    event.stopPropagation();
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Hamburger Menu Logic
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling to document immediately
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
}

