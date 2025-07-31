const API_KEY = 'ce18d7b3';
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const resultsDiv = document.getElementById('results');
const themeToggle = document.querySelector('.theme-toggle');

// Modo oscuro/claro
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const icon = themeToggle.querySelector('i');
    if (document.body.classList.contains('dark-mode')) {
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
    }
});

// Búsqueda al hacer clic o presionar Enter
searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchMovies();
});

// Efecto de carga
function showLoading() {
    resultsDiv.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
        </div>
    `;
}

// Mostrar mensaje de error
function showError(message) {
    resultsDiv.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

// Mostrar películas
function displayMovies(movies) {
    if (!movies || movies.length === 0) {
        showError('No se encontraron resultados');
        return;
    }

    // Eliminar duplicados
    const uniqueMovies = [];
    const ids = new Set();
    
    movies.forEach(movie => {
        if (movie.Poster !== 'N/A' && !ids.has(movie.imdbID)) {
            ids.add(movie.imdbID);
            uniqueMovies.push(movie);
        }
    });

    if (uniqueMovies.length === 0) {
        showError('No hay películas con imágenes disponibles');
        return;
    }

    const moviesHTML = uniqueMovies.map(movie => `
        <div class="movie-card">
            <img src="${movie.Poster}" alt="${movie.Title}" class="movie-poster">
            <div class="movie-info">
                <h3 class="movie-title">${movie.Title}</h3>
                <p class="movie-year">${movie.Year.substring(0, 4)}</p>
                <span class="movie-type">${movie.Type === 'movie' ? 'Película' : 'Serie'}</span>
            </div>
        </div>
    `).join('');

    resultsDiv.innerHTML = `<div class="movie-grid">${moviesHTML}</div>`;
}

// Función principal de búsqueda
async function searchMovies() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        showError('Por favor ingresa un título');
        return;
    }

    try {
        showLoading();
        
        const response = await fetch(
            `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${API_KEY}&type=movie`
        );
        
        if (!response.ok) throw new Error('Error en la conexión');
        
        const data = await response.json();
        
        if (data.Response === 'True') {
            displayMovies(data.Search);
        } else {
            showError(data.Error || 'No se encontraron resultados');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error al conectar con el servidor');
    }
}

// Efecto de máquina de escribir en el placeholder
const placeholderText = "Buscar: Titanic, Avengers, Jurassic Park...";
let i = 0;
function typeWriter() {
    if (i < placeholderText.length) {
        searchInput.placeholder += placeholderText.charAt(i);
        i++;
        setTimeout(typeWriter, 50);
    }
}
typeWriter();