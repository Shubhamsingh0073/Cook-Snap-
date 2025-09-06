
(function () {
    'use strict';

    const API_BASE = 'https://www.themealdb.com/api/json/v1/1';
    const LS_FAVS = 'rf_favourites_v1';
    const LS_ACC = 'rf_accent_v1';

    // DOM refs
    const resultsEl = document.getElementById('results');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const rndBtn = document.getElementById('rndBtn');
    const showFavsBtn = document.getElementById('showFavs');
    const favCountEl = document.getElementById('favCount');
    const homeBtn = document.getElementById('homeBtn');

    const modal = document.getElementById('modal');
    const modalImg = document.getElementById('modalImg');
    const modalTitle = document.getElementById('modalTitle');
    const modalCategory = document.getElementById('modalCategory');
    const modalArea = document.getElementById('modalArea');
    const modalInstructions = document.getElementById('modalInstructions');
    const modalIngredients = document.getElementById('modalIngredients');
    const modalLinks = document.getElementById('modalLinks');
    const modalFav = document.getElementById('modalFav');
    const closeModalBtn = document.getElementById('closeModal');

    const favDrawer = document.getElementById('favDrawer');
    const favListContainer = document.getElementById('favListContainer');
    const closeFavsBtn = document.getElementById('closeFavs');
    const clearFavsBtn = document.getElementById('clearFavs');

    // fallback sample
    const sampleRecipes = [
        { idMeal: 's1', strMeal: 'Sample Bowl', strCategory: 'Sample', strArea: 'Global', strMealThumb: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop', strInstructions: 'Sample instructions', strYoutube: '', ingredients: ['Ingredient 1', 'Ingredient 2'] }
    ];

    // state
    let state = {
        recipes: [],
        favourites: loadFavs(),
        currentRecipe: null
    };

    // helpers
    function safe(s) { return (s === null || s === undefined) ? '' : String(s); }
    function uid() { return 'id_' + Math.random().toString(36).slice(2, 9); }
    function randomHue() { return Math.floor(Math.random() * 360); }

    // Accent management
    function setAccent(h, s = 78, l = 56) {
        const acc = 'hsl(' + h + ',' + s + '%,' + l + '%)';
        document.documentElement.style.setProperty('--accent', acc);
        document.documentElement.style.setProperty('--accent-contrast', '#fff');
        try { localStorage.setItem(LS_ACC, JSON.stringify({ h, s, l })); } catch (e) { }
        // tweak blobs colors slightly
        const blobs = document.querySelector('.blobs');
        if (blobs) {
            const h1 = h, h2 = (h + 70) % 360, h3 = (h + 200) % 360;
            blobs.style.background = 'radial-gradient(circle at 20% 30%, hsla(' + h1 + ',85%,50%,0.12), transparent 12%), radial-gradient(circle at 80% 80%, hsla(' + h2 + ',75%,50%,0.07), transparent 18%), radial-gradient(circle at 40% 70%, hsla(' + h3 + ',60%,50%,0.05), transparent 14%)';
        }
    }
    function loadAccent() {
        try {
            const raw = localStorage.getItem(LS_ACC);
            if (raw) {
                const { h, s, l } = JSON.parse(raw);
                setAccent(h, s, l);
                return;
            }
        } catch (e) { }
        setAccent(270);
    }

    // localStorage favourites
    function loadFavs() {
        try {
            const raw = localStorage.getItem(LS_FAVS);
            if (raw) return JSON.parse(raw);
        } catch (e) { }
        return [];
    }
    function saveFavs() {
        try { localStorage.setItem(LS_FAVS, JSON.stringify(state.favourites)); } catch (e) { }
        renderFavCount();
    }

    // Map meal to normalized object (extract ingredients)
    function mapMeal(m) {
        if (!m) return null;
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            try {
                const ingr = m['strIngredient' + i];
                const measure = m['strMeasure' + i];
                if (ingr && String(ingr).trim()) {
                    ingredients.push((measure && String(measure).trim()) ? (String(measure).trim() + ' ' + String(ingr).trim()) : String(ingr).trim());
                }
            } catch (e) { }
        }
        return {
            idMeal: m.idMeal || uid(),
            strMeal: safe(m.strMeal),
            strCategory: safe(m.strCategory),
            strArea: safe(m.strArea),
            strMealThumb: safe(m.strMealThumb),
            strInstructions: safe(m.strInstructions),
            strYoutube: safe(m.strYoutube),
            ingredients
        };
    }

    // API calls
    async function searchMeals(q) {
        if (!q) return [];
        try {
            const res = await fetch(API_BASE + '/search.php?s=' + encodeURIComponent(q));
            if (!res.ok) throw new Error('Network: ' + res.status);
            const data = await res.json();
            if (!data || !data.meals) return [];
            return data.meals.map(mapMeal).filter(Boolean);
        } catch (err) {
            console.warn('searchMeals fallback', err);
            return sampleRecipes;
        }
    }
    async function lookupMeal(id) {
        if (!id) return null;
        try {
            const res = await fetch(API_BASE + '/lookup.php?i=' + encodeURIComponent(id));
            if (!res.ok) throw new Error('Network: ' + res.status);
            const data = await res.json();
            if (!data || !data.meals) return null;
            return mapMeal(data.meals[0]);
        } catch (err) {
            console.warn('lookup fallback', err);
            return null;
        }
    }
    async function randomSelection() {
        try {
            const letters = ['a', 'b', 'c', 'd', 'm', 's', 'p', 't', 'r', 'l'];
            const promises = letters.slice(0, 6).map(l => fetch(API_BASE + '/search.php?s=' + encodeURIComponent(l)).then(r => r.json()).catch(() => null));
            const results = await Promise.all(promises);
            const meals = [];
            results.forEach(r => { if (r && r.meals) r.meals.forEach(m => meals.push(mapMeal(m))); });
            if (meals.length) return meals.slice(0, 12);
        } catch (e) { console.warn('randomSelection failed', e); }
        return sampleRecipes;
    }

    // Rendering results
    function renderRecipes(arr) {
        if (!resultsEl) return;
        resultsEl.innerHTML = '';
        if (!arr || arr.length === 0) {
            resultsEl.innerHTML = '<div class="muted" style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">No results</div>';
            return;
        }
        arr.forEach(item => {
            if (!item) return;
            const card = document.createElement('article');
            card.className = 'card';
            const thumb = item.strMealThumb || '';
            const excerpt = (item.strInstructions || '').slice(0, 120) + ((item.strInstructions && item.strInstructions.length > 120) ? '...' : '');
            card.innerHTML = ''
                + '<div class="thumb" style="background-image:url(\'' + thumb + '\')"></div>'
                + '<div class="body">'
                + '<div style="font-weight:700">' + safe(item.strMeal) + '</div>'
                + '<div class="meta">' + safe(item.strCategory) + ' • ' + safe(item.strArea) + '</div>'
                + '<div class="excerpt">' + safe(excerpt) + '</div>'
                + '<div class="actions">'
                + '<div><button class="btn" data-action="view" data-id="' + item.idMeal + '">View</button></div>'
                + '<div><button class="fav" data-action="fav" data-id="' + item.idMeal + '" title="Save to favourites" aria-pressed="false">'
                + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                + '</button></div>'
                + '</div>'
                + '</div>';
            // events binding
            const viewBtn = card.querySelector('[data-action="view"]');
            const favBtn = card.querySelector('[data-action="fav"]');
            if (viewBtn) viewBtn.addEventListener('click', () => openModalById(item.idMeal));
            if (favBtn) {
                if (isFav(item.idMeal)) favBtn.classList.add('hearted');
                favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(item); updateFavButtons(item.idMeal); });
            }
            resultsEl.appendChild(card);
        });
    }

    // Favourites management & drawer rendering
    function isFav(id) { return state.favourites.some(x => x.idMeal === id); }

    function toggleFav(recipe) {
        if (!recipe || !recipe.idMeal) return;
        if (isFav(recipe.idMeal)) {
            state.favourites = state.favourites.filter(x => x.idMeal !== recipe.idMeal);
        } else {
            state.favourites.unshift({
                idMeal: recipe.idMeal,
                strMeal: recipe.strMeal || '',
                strCategory: recipe.strCategory || '',
                strArea: recipe.strArea || '',
                strMealThumb: recipe.strMealThumb || ''
            });
        }
        saveFavs();
        renderFavDrawerContents();
        updateFavButtons(recipe.idMeal);
    }

    function removeFav(id) {
        state.favourites = state.favourites.filter(x => x.idMeal !== id);
        saveFavs();
        renderFavDrawerContents();
        updateFavButtons(id);
    }

    function renderFavCount() { if (favCountEl) favCountEl.textContent = String(state.favourites.length); }

    function renderFavDrawerContents() {
        if (!favListContainer) return;
        favListContainer.innerHTML = '';
        if (!state.favourites.length) {
            favListContainer.innerHTML = '<div class="muted">No favourites yet — click the ♥ on any recipe to save it here.</div>';
            renderFavCount();
            return;
        }
        state.favourites.forEach(f => {
            const el = document.createElement('div');
            el.className = 'fav-item';
            el.innerHTML = ''
                + '<img src="' + safe(f.strMealThumb) + '" alt="' + safe(f.strMeal) + '">'
                + '<div style="flex:1"><div style="font-weight:700">' + safe(f.strMeal) + '</div><div class="muted" style="font-size:13px">' + safe(f.strCategory) + ' • ' + safe(f.strArea) + '</div></div>'
                + '<div style="display:flex;flex-direction:column;gap:8px">'
                + '<button class="btn" data-action="open" data-id="' + f.idMeal + '">Open</button>'
                + '<button class="btn" data-action="remove" data-id="' + f.idMeal + '">Remove</button>'
                + '</div>';
            const openBtn = el.querySelector('[data-action="open"]');
            const removeBtn = el.querySelector('[data-action="remove"]');
            if (openBtn) openBtn.addEventListener('click', () => openModalById(f.idMeal));
            if (removeBtn) removeBtn.addEventListener('click', () => removeFav(f.idMeal));
            favListContainer.appendChild(el);
        });
        renderFavCount();
    }

    function updateFavButtons(id) {
        try {
            document.querySelectorAll('[data-action="fav"]').forEach(btn => {
                if (btn && btn.dataset && btn.dataset.id === id) {
                    btn.classList.toggle('hearted', isFav(id));
                    btn.setAttribute('aria-pressed', String(isFav(id)));
                    btn.title = isFav(id) ? 'Remove from favourites' : 'Save to favourites';
                }
            });
            // modal toggle
            if (state.currentRecipe && state.currentRecipe.idMeal === id && modalFav) {
                modalFav.classList.toggle('hearted', isFav(id));
                modalFav.setAttribute('aria-pressed', String(isFav(id)));
                modalFav.title = isFav(id) ? 'Remove from favourites' : 'Save to favourites';
            }
        } catch (e) { }
        renderFavCount();
    }

    // Modal population (fetch fresh data)
    async function openModalById(id) {
        if (!id) return;
        const fresh = await lookupMeal(id);
        const meal = fresh || state.recipes.find(r => r.idMeal === id) || state.favourites.find(f => f.idMeal === id) || null;
        if (!meal) {
            alert('Recipe details are not available');
            return;
        }
        state.currentRecipe = meal;
        if (modalImg) modalImg.src = meal.strMealThumb || '';
        if (modalTitle) modalTitle.textContent = meal.strMeal || '';
        if (modalCategory) modalCategory.textContent = meal.strCategory || '';
        if (modalArea) modalArea.textContent = meal.strArea || '';
        if (modalInstructions) modalInstructions.textContent = meal.strInstructions || '';
        // ingredients
        if (modalIngredients) {
            modalIngredients.innerHTML = '';
            if (Array.isArray(meal.ingredients) && meal.ingredients.length) {
                meal.ingredients.forEach(ing => {
                    const d = document.createElement('div'); d.className = 'ingredient'; d.textContent = ing; modalIngredients.appendChild(d);
                });
            } else {
                modalIngredients.innerHTML = '<div class="muted">No ingredient data</div>';
            }
        }
        // Links: show YouTube and "View on TheMealDB"
        if (modalLinks) {
            modalLinks.innerHTML = '';
            if (meal.strYoutube) {
                const y = document.createElement('a'); y.href = meal.strYoutube; y.target = '_blank'; y.rel = 'noopener'; y.className = 'accent-link'; y.textContent = 'YouTube';
                modalLinks.appendChild(y);
            }
            if (modalLinks.childElementCount) modalLinks.appendChild(document.createTextNode(' • '));
            const mealdbLink = document.createElement('a');
            mealdbLink.href = 'https://www.themealdb.com/meal/' + encodeURIComponent(meal.idMeal);
            mealdbLink.target = '_blank';
            mealdbLink.rel = 'noopener';
            mealdbLink.className = 'accent-link';
            mealdbLink.textContent = 'View on TheMealDB';
            modalLinks.appendChild(mealdbLink);
        }
        if (modalFav) {
            modalFav.classList.toggle('hearted', isFav(meal.idMeal));
            modalFav.setAttribute('aria-pressed', String(isFav(meal.idMeal)));
            modalFav.title = isFav(meal.idMeal) ? 'Remove from favourites' : 'Save to favourites';
        }
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeModal() {
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
        state.currentRecipe = null;
    }

    // Drawer controls
    function openFavsDrawer() {
        if (!favDrawer) return;
        favDrawer.classList.add('open');
        favDrawer.setAttribute('aria-hidden', 'false');
        showFavsBtn.setAttribute('aria-expanded', 'true');
        renderFavDrawerContents();
    }
    function closeFavsDrawer() {
        if (!favDrawer) return;
        favDrawer.classList.remove('open');
        favDrawer.setAttribute('aria-hidden', 'true');
        showFavsBtn.setAttribute('aria-expanded', 'false');
    }
    function toggleFavsDrawer() {
        if (!favDrawer) return;
        if (favDrawer.classList.contains('open')) closeFavsDrawer(); else openFavsDrawer();
    }

    // Event wiring
    if (searchBtn) searchBtn.addEventListener('click', async () => {
        const q = (searchInput.value || '').trim();
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
        try {
            const res = q ? await searchMeals(q) : await randomSelection();
            state.recipes = res;
            renderRecipes(res);
        } catch (e) { console.error(e); }
        finally { searchBtn.disabled = false; searchBtn.textContent = 'Search'; }
    });
    if (searchInput) searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && searchBtn) searchBtn.click(); });

    if (rndBtn) rndBtn.addEventListener('click', () => setAccent(randomHue()));
    if (showFavsBtn) showFavsBtn.addEventListener('click', () => {
        if (!state.favourites.length) {
            alert('No favourites yet — click the heart on a recipe to save it.');
            return;
        }
        toggleFavsDrawer();
    });
    if (closeFavsBtn) closeFavsBtn.addEventListener('click', closeFavsDrawer);
    if (clearFavsBtn) clearFavsBtn.addEventListener('click', () => {
        if (!confirm('Clear all favourites?')) return;
        state.favourites = [];
        saveFavs();
        renderFavDrawerContents();
        updateFavButtons();
        closeFavsDrawer();
    });

    // Results delegation for view/fav (supports dynamically added cards)
    resultsEl.addEventListener('click', (e) => {
        const v = e.target.closest('[data-action="view"]');
        if (v) { openModalById(v.dataset.id); return; }
        const f = e.target.closest('[data-action="fav"]');
        if (f) {
            const id = f.dataset.id;
            const rec = state.recipes.find(r => r.idMeal === id) || state.favourites.find(r => r.idMeal === id);
            if (rec) { toggleFav(rec); updateFavButtons(id); }
        }
    });

    // modal buttons
    if (modalFav) modalFav.addEventListener('click', () => { if (!state.currentRecipe) return; toggleFav(state.currentRecipe); updateFavButtons(state.currentRecipe.idMeal); renderFavDrawerContents(); });
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeFavsDrawer(); } });

    // Home button: reload to initial state
    if (homeBtn) homeBtn.addEventListener('click', () => {
        // reset search input and reload initial random selection
        searchInput.value = '';
        // simple, non-destructive approach: reload the page
        window.location.reload();
    });

    // Init functions
    async function init() {
        loadAccent();
        renderFavCount();
        renderFavDrawerContents();
        try {
            const items = await randomSelection();
            state.recipes = items;
            renderRecipes(items);
        } catch (e) {
            console.warn('init fallback', e);
            renderRecipes(sampleRecipes);
        }
    }

    // Expose lookup and search used in modal population
    async function lookupMeal(id) {
        if (!id) return null;
        try {
            const res = await fetch(API_BASE + '/lookup.php?i=' + encodeURIComponent(id));
            if (!res.ok) throw new Error('Network: ' + res.status);
            const data = await res.json();
            if (!data || !data.meals) return null;
            return mapMeal(data.meals[0]);
        } catch (e) {
            console.warn('lookupMeal failed', e);
            return null;
        }
    }

    // run
    init();

    // expose for debugging
    window.RF = { state, searchMeals, lookupMeal, openFavsDrawer };

})();