document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    // Global Filter State
    window.currentCategoryFilter = 'ALL'; // ALL, POLISH, FOREIGN, ARTIST
    window.currentCategoryValue = null;
    window.currentInputLabel = null;

    // Pobierz dane produktów
    fetch('products.json')
        .then(response => response.json())
        .then(products => {
            // Process products to add name and description if missing
            products.forEach(p => {
                if (!p.isCustom) {
                    p.name = `${p.artist} „${p.album}”`;
                    p.description = `🎶 Ręcznie stworzony brelok (5cm×4.5cm×0.8cm) inspirowany kultowym albumem ${p.album}.\n💿 Wyposażony w chip NFC, który po zbliżeniu telefonu automatycznie otwiera album w Spotify.\n📱 W wiadomości przy zakupie możesz wskazać inną aplikację — np. Apple Music.\n\n✨ Jeśli interesuje cię inny album, sprawdź pozostałe oferty lub zamów brelok spersonalizowany według Ciebie!\n💰 Przy zakupie kilku breloków <b>duża promka!</b>`;
                }
            });

            // Populate Nav Filter (Dropdown)
            const artistList = document.getElementById('artistList');
            if (artistList) {
                // Calculate counts
                const allCount = products.filter(p => !p.isCustom).length;
                const polishCount = products.filter(p => !p.isCustom && p.isPolish).length;
                const foreignCount = products.filter(p => !p.isCustom && !p.isPolish).length;
                
                const artists = [...new Set(products.map(p => p.artist).filter(a => a && a !== 'Custom'))].sort();
                
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
                        
                        // Set search input to label (for display)
                        const searchInput = document.getElementById('navSearchInput');
                        if (searchInput) {
                            searchInput.value = inputLabel || filterValue || "";
                        }
                        
                        // If not on landing page, go there
                        const urlParams = new URLSearchParams(window.location.search);
                        if (urlParams.get('page') || urlParams.get('id')) {
                            window.history.pushState({}, '', 'index.html');
                        }
                        
                        renderLandingPage(products);
                    };
                    return link;
                };

                // Clear existing
                artistList.innerHTML = '';

                // Add Special Options
                artistList.appendChild(createLink(`WSZYSTKIE (${allCount})`, 'ALL', null, true, ''));
                artistList.appendChild(createLink(`POLSKIE (${polishCount})`, 'POLISH', null, true, 'Polskie albumy'));
                artistList.appendChild(createLink(`ZAGRANICZNE (${foreignCount})`, 'FOREIGN', null, true, 'Zagraniczne albumy'));
                
                // Divider
                const divider = document.createElement('div');
                divider.style.borderTop = "1px solid #eee";
                divider.style.margin = "5px 0";
                artistList.appendChild(divider);

                // Add Artists
                artists.forEach(artist => {
                    const count = products.filter(p => p.artist === artist && !p.isCustom).length;
                    artistList.appendChild(createLink(`${artist} (${count})`, 'ARTIST', artist, false, artist));
                });
            }

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
                        window.history.pushState({}, '', 'index.html');
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
        const navSearchContainer = document.getElementById('navSearchContainer');
        if (navSearchContainer) navSearchContainer.style.display = 'none';

        document.title = 'Kontakt - FajneBreloki.pl';
        app.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; background: white; border-radius: 0 0 20px 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.05);">
                <h1 style="text-align: center; margin-bottom: 40px;">Skontaktuj się ze mną 📞</h1>
                
                <div class="contact-grid">
                    <div style="text-align: center; padding: 30px; background: #f9f9f9; border-radius: 15px;">
                        <h3 style="margin-bottom: 15px;">📧 Email</h3>
                        <p style="font-size: 1.1rem;">
                            <a href="mailto:kamiljama@gmail.com" title="Kliknij, aby napisać maila" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">kamiljama@gmail.com</a>
                        </p>
                        <p style="margin-top: 10px; color: #666; font-size: 0.9rem;">Odpisuję zazwyczaj w ciągu 12h</p>
                    </div>

                    <div style="text-align: center; padding: 30px; background: #f9f9f9; border-radius: 15px;">
                        <h3 style="margin-bottom: 15px;">📸 Instagram</h3>
                        <p style="font-size: 1.1rem;">
                            <a href="https://instagram.com/kkkejkus" title="Kliknij, aby przejść do Instagrama" target="_blank" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">@kkkejkus</a>
                        </p>
                        <p style="margin-top: 10px; color: #666; font-size: 0.9rem;">Odpisuję zazwyczaj w ciągu 1h</p>
                    </div>
                </div>

                <div style="margin-top: 50px; text-align: center;">
                    <h3>Masz pytanie o zamówienie? 🎁</h3>
                    <p style="color: #555; margin-top: 10px;">
                        Najszybciej skontaktujesz się ze mną poprzez wiadomość prywatną na Instagramie.<br/>Odpowiedzi na maile mogą czasem zająć trochę więcej czasu.
                    </p>
                </div>
            </div>
        `;
    }

    // Funkcja renderująca stronę główną
    function renderLandingPage(products) {
        // Show nav search container
        const navSearchContainer = document.getElementById('navSearchContainer');
        if (navSearchContainer) navSearchContainer.style.display = 'flex';

        // 2. Renderuj szkielet strony (Hero + Grid Container)
        const html = `
            <section class="hero">
                <div class="hero-content">
                    <h1>Muzyka zawsze przy Tobie🎶</h1>
                    <p>Unikalne breloki w kształcie mini płyt CD z chipem NFC.<br/>Zbliż telefon i odtwarzaj swój ulubiony album w Spotify! 🎧</p>
                </div>
                <div class="hero-image">
                    <img id="heroImage" src="media/main1.png" alt="Brelok z muzyką">
                    <button id="heroNextBtn" class="hero-arrow" title="Następne zdjęcie">❯</button>
                </div>
            </section>
            
            <div class="view-controls" style="display: flex; justify-content: flex-end; margin-bottom: 1rem; padding: 0 10px;">
                <button class="view-toggle-btn" data-mode="default" title="Widok domyślny">⊞</button>
                <button class="view-toggle-btn" data-mode="compact" title="Widok kompaktowy">▦</button>
                <button class="view-toggle-btn" data-mode="list" title="Widok listy">☰</button>
            </div>

            <div id="productsGrid" class="products-grid">
                <!-- Produkty zostaną wstawione tutaj przez JavaScript -->
            </div>
        `;

        app.innerHTML = html;

        // 3. Logika filtrowania
        const productsGrid = document.getElementById('productsGrid');
        const viewBtns = document.querySelectorAll('.view-toggle-btn');

        // Hero Image Slider Logic
        const heroImage = document.getElementById('heroImage');
        const heroNextBtn = document.getElementById('heroNextBtn');
        if (heroImage && heroNextBtn) {
            const images = ['media/main1.png', 'media/main2.png'];
            let currentImageIndex = 0;
            
            heroNextBtn.addEventListener('click', () => {
                currentImageIndex = (currentImageIndex + 1) % images.length;
                heroImage.style.opacity = 0;
                
                setTimeout(() => {
                    const newSrc = images[currentImageIndex];
                    // Preload image to ensure smooth transition
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        heroImage.src = newSrc;
                        heroImage.style.opacity = 1;
                    };
                    tempImg.src = newSrc;
                }, 200);
            });
        }

        // Obsługa przełączania widoku
        if (viewBtns.length > 0) {
            let currentMode = localStorage.getItem('productsViewMode') || 'default';
            const modes = ['default', 'compact', 'list'];
            if (!modes.includes(currentMode)) currentMode = 'default';

            const updateView = (mode) => {
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
                
                localStorage.setItem('productsViewMode', mode);
                currentMode = mode;
            };

            // Initial render
            updateView(currentMode);

            viewBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    updateView(btn.dataset.mode);
                });
            });
        }

        const navSearchInput = document.getElementById('navSearchInput');

        let searchTerm = navSearchInput ? navSearchInput.value : '';

        function filterAndRender() {
            const filtered = products.filter(p => {
                // Customowy zawsze widoczny
                if (p.isCustom) return true;

                const filterType = window.currentCategoryFilter || 'ALL';
                const filterValue = window.currentCategoryValue;
                
                // Determine if product matches the category filter
                let matchesCategory = true;
                
                if (filterType === 'POLISH') {
                    matchesCategory = p.isPolish === true;
                } else if (filterType === 'FOREIGN') {
                    matchesCategory = p.isPolish === false;
                } else if (filterType === 'ARTIST') {
                    matchesCategory = p.artist === filterValue;
                }

                // Wyszukiwanie po nazwie (name) lub artyście
                let term = searchTerm.toLowerCase();
                
                // Ignore search term if it matches the current category label (display only)
                if (window.currentInputLabel && term === window.currentInputLabel.toLowerCase()) {
                    term = '';
                }

                const matchesSearch = p.name.toLowerCase().includes(term) || p.artist.toLowerCase().includes(term);
                
                return matchesCategory && matchesSearch;
            });
            
            renderGrid(filtered);
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

            navSearchInput.addEventListener('input', handleInput);
            
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

        function renderGrid(filteredProducts) {
            if (filteredProducts.length === 0) {
                productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">Nie znaleziono produktów spełniających kryteria.</p>';
                return;
            }

            let gridHtml = '';
            filteredProducts.forEach(product => {
                // Use promoPrice if available, otherwise price
                const displayPrice = product.promoPrice || product.price;
                const oldPrice = product.isCustom ? "50.00" : "45.00";
                const image1 = product.images && product.images.length > 0 ? product.images[0] : 'https://placehold.co/600x600?text=No+Image';
                const image2 = product.images && product.images.length > 1 ? product.images[1] : image1;
                
                const isCustom = product.isCustom ? 'custom-card' : '';
                const customLabel = product.isCustom ? '<div class="custom-label">NA ZAMÓWIENIE</div>' : '';

                gridHtml += `
                    <a href="index.html?id=${product.id}" class="product-card ${isCustom}">
                        ${customLabel}
                        <div class="card-image-container">
                            <img src="${image1}" alt="${product.name}" class="card-image card-image-main">
                            <img src="${image2}" alt="${product.name} - widok 2" class="card-image card-image-hover">
                        </div>
                        <div class="card-content">
                            <h3 class="card-title">${product.name}</h3>
                            <p class="card-price">${displayPrice.toFixed(2)} zł <span style="font-size:0.9rem; color:#999; text-decoration:line-through; margin-left:5px; font-weight: normal;">${oldPrice} zł</span></p>
                        </div>
                    </a>
                `;
            });
            productsGrid.innerHTML = gridHtml;
        }

        // Event Listeners
        // searchInput removed from DOM, logic moved to navSearchInput above

        // Pierwsze renderowanie
        filterAndRender();
    }

    // Funkcja renderująca szczegóły produktu
    function renderProductDetail(id, products) {
        const navSearchContainer = document.getElementById('navSearchContainer');
        if (navSearchContainer) navSearchContainer.style.display = 'none';

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

        // Determine prices
        const vintedPrice = product.promoPrice ? product.promoPrice.toFixed(2) : product.price.toFixed(2);
        const standardPrice = product.price.toFixed(2);
        const oldPrice = product.isCustom ? "50.00" : "45.00";
        
        const image1 = product.images && product.images.length > 0 ? product.images[0] : 'https://placehold.co/600x600?text=No+Image';
        
        let thumbnailsHtml = '';
        if (product.images && product.images.length > 1) {
            thumbnailsHtml = `
                <div class="detail-thumbnails">
                    ${product.images.map((img, index) => {
                        const label = index === 0 ? "Okładka" : "Wnętrze";
                        return `
                        <div class="thumbnail-wrapper" onclick="changeMainImage(this, '${img}', ${index})">
                            <img src="${img}" class="thumbnail ${index === 0 ? 'active' : ''}" alt="${label}">
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
                                    <option value="vinted">Vinted (${product.promoPrice.toFixed(2)} zł - Najtaniej!)</option>
                                    <option value="olx">OLX (${product.price.toFixed(2)} zł)</option>
                                    <option value="allegro">Allegro Lokalnie (${product.price.toFixed(2)} zł)</option>
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
                        <span class="price-tag">${vintedPrice} zł</span>
                    </a>
                    
                    <a href="${product.olxUrl}" title="Kliknij, aby przejść na OLX" target="_blank" rel="noopener noreferrer" class="btn-buy btn-olx">
                        <span>KUP TERAZ NA OLX</span>
                        <span class="price-tag">${standardPrice} zł</span>
                    </a>

                    <a href="${product.allegroUrl}" title="Kliknij, aby przejść na Allegro Lokalnie" target="_blank" rel="noopener noreferrer" class="btn-buy btn-allegro">
                        <span>KUP TERAZ NA <br class="mobile-break">ALLEGRO LOKALNIE</span>
                        <span class="price-tag">${standardPrice} zł</span>
                    </a>
                </div>
            `;
        }

        const html = `
            <a href="index.html" class="back-link">← Wróć do strony głównej</a>
            <div class="product-detail-container">
                <div class="product-detail">
                    <div class="detail-image">
                        <img id="mainImage" src="${image1}" alt="${product.name}" onclick="openLightbox(lightboxIndex)" style="cursor: zoom-in;">
                        ${thumbnailsHtml}
                    </div>
                    <div class="detail-info">
                        <h1 style="line-height: 0.8;"><strong>Brelok CD z NFC💥</strong><br><span style="font-size: calc(100% - 8px);">${product.name}</span></h1>
                        <p class="detail-price">${vintedPrice} zł <span style="font-size:1rem; color:#999; text-decoration:line-through; margin-left:10px;">${oldPrice} zł</span></p>
                        <p class="detail-desc" style="white-space: pre-line;">${product.description || `Ręcznie wykonany brelok z okładką albumu **${product.album}** artysty **${product.artist}**. Wyposażony w chip NFC, który po zbliżeniu telefonu otwiera album w Spotify.`}</p>
                        
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
        const navSearchContainer = document.getElementById('navSearchContainer');
        if (navSearchContainer) navSearchContainer.style.display = 'none';

        document.title = 'Wysyłka - FajneBreloki.pl';
        app.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="text-align: center; margin-bottom: 40px;">Informacje o wysyłce 📦</h1>
                
                <div style="margin-bottom: 50px; text-align: center; padding: 20px; background: #f0f8ff; border-radius: 15px; border: 1px solid #d1e7dd; max-width: 600px; margin-left: auto; margin-right: auto;">
                    <h3 style="color: #0f5132; margin-bottom: 15px;">⏱️ Czas realizacji</h3>
                    <p style="font-size: 1.1rem; margin-bottom: 5px;"><strong>Standardowe breloki:</strong> wysyłka w 24h</p>
                    <p style="font-size: 1.1rem; margin-bottom: 15px;"><strong>Breloki customowe:</strong> wysyłka do 48h</p>
                    
                    <div style="border-top: 1px solid #d1e7dd; margin: 10px 40px; padding-top: 15px;">
                        <p style="font-size: 1.1rem;"><strong>📍 Odbiór osobisty:</strong> Wrocław</p>
                        <p style="font-size: 0.9rem; color: #555">(po wcześniejszym umówieniu)</p>
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
                            <li class="disabled">❌ DHL, UPS, Pocztex</li>
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
    }

    // Funkcja renderująca stronę FAQ
    function renderFaqPage() {
        const navSearchContainer = document.getElementById('navSearchContainer');
        if (navSearchContainer) navSearchContainer.style.display = 'none';

        document.title = 'FAQ - FajneBreloki.pl';
        app.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto;">
                <h1 style="text-align: center; line-height: 1.2; padding: 40px 0 20px; font-size: 2.5rem;">Jak to działa? 🤔</h1>
                
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

                <h2 style="text-align: center; line-height: 1.2; padding-bottom: 20px; font-size: 2rem;">Częste pytania (FAQ)</h2>

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
                <img id="lightboxImage" src="">
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
    hamburger.addEventListener('click', () => {
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
}
