document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    // Pobierz dane produktów
    fetch('products.json')
        .then(response => response.json())
        .then(products => {
            // Process products to add name and description if missing
            products.forEach(p => {
                if (!p.isCustom) {
                    p.name = `${p.artist} „${p.album}”`;
                    p.description = `🎶 Ręcznie stworzony brelok (5cm×4.5cm×0.8cm) inspirowany kultowym albumem ${p.album}.\n💿 Wyposażony w chip NFC, który po zbliżeniu telefonu automatycznie otwiera album w Spotify.\n📱 W wiadomości przy zakupie możesz wskazać inną aplikację — np. Apple Music.\n\n✨ Jeśli interesuje cię inny album, sprawdź pozostałe oferty lub zamów brelok spersonalizowany według Ciebie!\n💰 Przy zakupie kilku breloków duża promka!`;
                }
            });

            // Populate Nav Filter (Dropdown)
            const artistList = document.getElementById('artistList');
            if (artistList) {
                const artists = [...new Set(products.map(p => p.artist).filter(a => a && a !== 'Custom'))].sort();
                
                // Add "All" option
                const allLink = document.createElement('a');
                allLink.href = "#";
                allLink.textContent = "Wszyscy artyści";
                allLink.onclick = (e) => {
                    e.preventDefault();
                    const searchInput = document.getElementById('navSearchInput');
                    if (searchInput) {
                        searchInput.value = "";
                        searchInput.dispatchEvent(new Event('input'));
                    }
                };
                artistList.appendChild(allLink);

                artists.forEach(artist => {
                    const link = document.createElement('a');
                    link.href = "#";
                    link.textContent = artist;
                    link.onclick = (e) => {
                        e.preventDefault();
                        const searchInput = document.getElementById('navSearchInput');
                        if (searchInput) {
                            searchInput.value = artist;
                            searchInput.dispatchEvent(new Event('input'));
                        }
                    };
                    artistList.appendChild(link);
                });
            }

            // Global Search Input Listener
            const navSearchInput = document.getElementById('navSearchInput');
            if (navSearchInput) {
                navSearchInput.addEventListener('input', (e) => {
                    const term = e.target.value;
                    
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
                <h1 style="text-align: center; margin-bottom: 40px;">Skontaktuj się ze mną</h1>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
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
                <h1>Muzyka zawsze przy Tobie</h1>
                <p>Unikalne breloki w kształcie mini płyt CD z chipem NFC.<br/>Zbliż telefon i odtwarzaj swój ulubiony album w Spotify! 🎧</p>
            </section>
            
            <div id="productsGrid" class="products-grid">
                <!-- Produkty zostaną wstawione tutaj przez JavaScript -->
            </div>
        `;

        app.innerHTML = html;

        // 3. Logika filtrowania
        const productsGrid = document.getElementById('productsGrid');
        const navSearchInput = document.getElementById('navSearchInput');

        let searchTerm = navSearchInput ? navSearchInput.value : '';

        function filterAndRender() {
            const filtered = products.filter(p => {
                // Customowy zawsze widoczny
                if (p.isCustom) return true;

                // Wyszukiwanie po nazwie (name) lub artyście
                const term = searchTerm.toLowerCase();
                const matchesSearch = p.name.toLowerCase().includes(term) || p.artist.toLowerCase().includes(term);
                
                return matchesSearch;
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
                    <a href="index.html" class="btn-buy btn-vinted" style="margin-top:20px; display:inline-block; width:auto;">Wróć do sklepu</a>
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
                    <h3>Zamów swój unikalny brelok💥</h3>
                    <p style="margin-bottom: 20px; font-size: 0.9rem;">Wypełnij formularz, a skontaktuję się z Tobą w celu ustalenia szczegółów.</p>
                    
                    <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
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
                                <label for="platform">Gdzie chcesz kupić?</label>
                                <select id="platform" name="platform">
                                    <option value="vinted">Vinted (Najtaniej!)</option>
                                    <option value="olx">OLX</option>
                                    <option value="allegro">Allegro Lokalnie</option>
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
                            <textarea id="details" name="details" rows="2" placeholder="np. link do konkretnej playlisty lub inne uwagi / zapytanie o brelok ze swoją grafiką..."></textarea>
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
                    <a href="${product.vintedUrl}" target="_blank" rel="noopener noreferrer" class="btn-buy btn-vinted">
                        <span>KUP TERAZ NA VINTED</span>
                        <span class="price-tag">${vintedPrice} zł</span>
                    </a>
                    
                    <a href="${product.olxUrl}" target="_blank" rel="noopener noreferrer" class="btn-buy btn-olx">
                        <span>KUP TERAZ NA OLX</span>
                        <span class="price-tag">${standardPrice} zł</span>
                    </a>

                    <a href="${product.allegroUrl}" target="_blank" rel="noopener noreferrer" class="btn-buy btn-allegro">
                        <span>KUP TERAZ NA ALLEGRO LOKALNIE</span>
                        <span class="price-tag">${standardPrice} zł</span>
                    </a>
                </div>

                <p style="margin-top: 20px; font-size: 0.8rem; color: #888; text-align: center;">
                    Wybierz swoją ulubioną platformę. Polecamy Vinted ze względu na najniższą cenę wysyłki i produktu!
                </p>
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
                        <p class="detail-desc" style="white-space: pre-line;">${product.description}</p>
                        
                        ${buySection}
                    </div>
                </div>
                ${formSection}
            </div>
        `;

        app.innerHTML = html;
    }

    // Funkcja renderująca stronę wysyłki
    function renderShippingPage() {
        const navSearchContainer = document.getElementById('navSearchContainer');
        if (navSearchContainer) navSearchContainer.style.display = 'none';

        document.title = 'Wysyłka - FajneBreloki.pl';
        app.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="text-align: center; margin-bottom: 40px;">Informacje o wysyłce</h1>
                
                <div style="margin-bottom: 50px; text-align: center; padding: 20px; background: #f0f8ff; border-radius: 15px; border: 1px solid #d1e7dd; max-width: 600px; margin-left: auto; margin-right: auto;">
                    <h3 style="color: #0f5132; margin-bottom: 10px;">⏱️ Czas realizacji</h3>
                    <p style="font-size: 1.1rem; margin-bottom: 5px;"><strong>Standardowe breloki:</strong> wysyłka w 24h</p>
                    <p style="font-size: 1.1rem;"><strong>Breloki customowe:</strong> wysyłka do 48h</p>
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