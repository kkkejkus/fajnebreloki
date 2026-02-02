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
    const REVIEWS_LAST_UPDATED_AT = new Date(2026, 1, 2, 20, 0, 0); // 02.02.2026 20:00 (local time)

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
                        <span class="reviews-badge"><span class="reviews-num">115+</span> <span class="reviews-label">opinii</span></span>
                        <span class="reviews-dot" aria-hidden="true">•</span>
                        <span class="reviews-badge"><span class="reviews-label">Średnia</span> <span class="reviews-num">5.0</span></span>
                        <span class="reviews-stars" aria-hidden="true">★★★★★</span>
                    </div>
                    <div class="reviews-updated" id="reviewsUpdated" aria-live="polite"></div>
                </div>

                <div class="reviews-scroll" id="reviewsScroll" role="list" aria-label="Lista opinii klientów">
                    <article class="review-card" role="listitem" data-index="1.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/04_00a64_UG1GYwuxMiUjXGTnxQZUhCV6/f800/1760890077.webp?s=18fd6a45186d2d03a0291c6185b68c565acf41c0" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">1.02.2026</div>
                        <div class="review-nick">@bran***</div>
                        <div class="review-text">Brelok świetny</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="2.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/06_02468_7JeZEwrAumZUWyekH1nqurTa/f800/1769713921.webp?s=480cd98d1b16f019662e4cef0783b26db4da4b85" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">29.01.2026</div>
                        <div class="review-nick">@gyer***</div>
                        <div class="review-text">The item shipping and packaging were totally alright, and it gives everything what was promised! Looks nice. I can recommend the seller :)</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="3.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/02_02103_Hpy694GxUGP71iGaXjJ836dq/f800/1752070120.webp?s=e8eeee5a64ee76719837edee43a231fb3d46831d" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">22.01.2026</div>
                        <div class="review-nick">@nats***</div>
                        <div class="review-text">Wszystko dobrze 👍 polecam serdecznie 🛍️</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="4.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/01_01a45_wKsRhTEKvDXN3L1Ww88qV1sq/f800/1756043385.webp?s=da5b99d150ffd586d644b7cc965d3a4cdd42aaaf" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">21.01.2026</div>
                        <div class="review-nick">fore***</div>
                        <div class="review-text">Szybka wysyłka, a brelok piękny i bezpiecznie zapakowany 🫡</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="5.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/04_020a3_gVLNUWm99yJJh8asfboAtj3L/f800/1733922291.webp?s=d66099a6578db9e8937ebbd2f41544d5210025df" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">19.01.2026</div>
                        <div class="review-nick">@gove***</div>
                        <div class="review-text">As described, quality product, fast shipping, properly packaged, good price. 👌</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="6.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/02_01487_oKDAkxqCf97BNZSaNxuVgiAt/f800/1703950451.webp?s=01412ca5d479c8b354ba7ce4b54d15f6a7d9d16b" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">18.01.2026</div>
                        <div class="review-nick">@luft***</div>
                        <div class="review-text">Wszystko top :D</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="7.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://marketplace-web-assets.vinted.com/assets/no-photo/user-empty-state.svg" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">16.01.2026</div>
                        <div class="review-nick">@juli***</div>
                        <div class="review-text">Szybka wysyłka i sprzedający szybko odpowiadał na moje pytania, polecam😊</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="8.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/03_02426_1f3uxwMbuh3F3aYeBfsisNFn/f800/1653325558.webp?s=e3b7c24c10776fa185c01187d793e4e95ea5efac" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">10.01.2026</div>
                        <div class="review-nick">@soli***</div>
                        <div class="review-text">Bardzo polecam, szyba wysylka i bardzo dobry kontakt ze sprzedającym!:)</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="9.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/05_0086f_LXfeyckaUPEoF9ruTxSBXa7u/f800/1763225997.webp?s=42612d65acb22ec1d0d3a1bdaa2a31efd9a5aca6" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">8.01.2026</div>
                        <div class="review-nick">@craz***</div>
                        <div class="review-text">Wszystko super. Szybka wysyłka. Mega wykonanie 👍👍👍 Gorąco polecam . Produkty wyglądają świetnie</div>
                    </article>

                    <article class="review-card" role="listitem" data-index="10.">
                        <span class="review-avatar-wrap" aria-hidden="true"><img class="review-avatar" src="https://images1.vinted.net/t/01_00d67_kr6azN5ZRkcDckyhM5stpMDb/f800/1673458474.webp?s=bf0ddaa70ca803cfdb3e28b0555a3202c6680cd3" alt="" loading="lazy" decoding="async"></span>
                        <div class="review-stars" aria-label="Ocena 5 na 5">★★★★★</div>
                        <div class="review-date">30.12.2025</div>
                        <div class="review-nick">@nupl***</div>
                        <div class="review-text">Szybka wysyłka, fantastyczny brelok. Polecam 🫶</div>
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
            .replace(/[^
