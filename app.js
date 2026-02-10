// Lithuania bounds
const lithuaniaBounds = [[53.89, 20.93], [56.45, 26.84]];
const lithuaniaCenter = [55.17, 23.88];

// Initialize map centered on Lithuania
const map = L.map('map', {
    maxBounds: lithuaniaBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 7
}).setView(lithuaniaCenter, 8);

// Add CartoDB Positron tiles (clean, no forest coloring)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Administrative layers
let countiesLayer = null;
let municipalitiesLayer = null;
let countiesData = null;
let municipalitiesData = null;

// Feature group for all drawings
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Store selected regions
const selectedRegions = {};
let layers = {};
let searchTimeout;
let selectedLocation = null;
let currentDrawMode = null;
let deleteMode = false;
let textMarkers = [];

// DOM elements - Location
const locationSearch = document.getElementById('location-search');
const searchResults = document.getElementById('search-results');
const colorPicker = document.getElementById('color-picker');
const borderOnlyCheckbox = document.getElementById('border-only');
const applyBtn = document.getElementById('apply-btn');
const clearBtn = document.getElementById('clear-btn');
const selectedList = document.getElementById('selected-list');

// DOM elements - Drawing tools
const drawArrowBtn = document.getElementById('draw-arrow');
const drawLineBtn = document.getElementById('draw-line');
const drawCircleBtn = document.getElementById('draw-circle');
const drawRectangleBtn = document.getElementById('draw-rectangle');
const drawPolygonBtn = document.getElementById('draw-polygon');
const addTextBtn = document.getElementById('add-text');
const deleteModeBtn = document.getElementById('delete-mode');

const drawColor = document.getElementById('draw-color');
const drawWidth = document.getElementById('draw-width');
const drawOpacity = document.getElementById('draw-opacity');
const drawingControls = document.getElementById('drawing-controls');
const cancelDrawBtn = document.getElementById('cancel-draw');

const textControls = document.getElementById('text-controls');
const textInput = document.getElementById('text-input');
const textSize = document.getElementById('text-size');
const placeTextBtn = document.getElementById('place-text');

// DOM elements - Administrative layers
const countiesToggle = document.getElementById('counties-toggle');
const municipalitiesToggle = document.getElementById('municipalities-toggle');
const countiesColor = document.getElementById('counties-color');
const municipalitiesColor = document.getElementById('municipalities-color');
const countiesOpacity = document.getElementById('counties-opacity');
const municipalitiesOpacity = document.getElementById('municipalities-opacity');
const countiesOpacityValue = document.getElementById('counties-opacity-value');
const municipalitiesOpacityValue = document.getElementById('municipalities-opacity-value');
const countiesWeight = document.getElementById('counties-weight');
const municipalitiesWeight = document.getElementById('municipalities-weight');
const countiesWeightValue = document.getElementById('counties-weight-value');
const municipalitiesWeightValue = document.getElementById('municipalities-weight-value');
const layerInfo = document.getElementById('layer-info');
const infoName = document.getElementById('info-name');
const infoDetails = document.getElementById('info-details');

// DOM elements - Sidebar toggle and modal
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const mapModal = document.getElementById('map-modal');
const modalClose = document.getElementById('modal-close');
const modalHeader = document.getElementById('modal-header');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');

// DOM elements - Data points
const fileImport = document.getElementById('file-import');
const dotSize = document.getElementById('dot-size');
const dotSizeValue = document.getElementById('dot-size-value');
const pointsCount = document.getElementById('points-count');
const clearPointsBtn = document.getElementById('clear-points');

// Data points layer
const dataPointsLayer = L.layerGroup().addTo(map);
let dataPoints = [];

// Gubernija colors
const gubernijaColors = {
    'Kauno': '#e74c3c',      // Red
    'Vilniaus': '#3498db',   // Blue
    'Suvalkų': '#27ae60'     // Green
};

// Get color for gubernija (or generate one for unknown)
function getGubernijColor(gubernija) {
    if (gubernijaColors[gubernija]) {
        return gubernijaColors[gubernija];
    }
    // Generate a color for unknown gubernijos
    const hash = gubernija.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    return `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
}

// ========== ADMINISTRATIVE LAYERS FUNCTIONS ==========

// Local GeoJSON files for Lithuania
async function loadAdministrativeLayers() {
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = 'Loading administrative boundaries...';
    document.body.appendChild(loadingDiv);

    try {
        // Load counties (admin level 1) and municipalities (admin level 2) from local files
        const [countiesResponse, municipalitiesResponse] = await Promise.all([
            fetch('gadm41_LTU_1.json'),
            fetch('gadm41_LTU_2.json')
        ]);

        countiesData = await countiesResponse.json();
        municipalitiesData = await municipalitiesResponse.json();

        // Create layers
        createCountiesLayer();
        createMunicipalitiesLayer();

        loadingDiv.remove();
    } catch (error) {
        console.error('Error loading administrative boundaries:', error);
        loadingDiv.innerHTML = 'Error loading data. Using fallback...';

        // Fallback: try alternative source or show error
        setTimeout(() => loadingDiv.remove(), 2000);
    }
}

function createCountiesLayer() {
    if (countiesLayer) {
        map.removeLayer(countiesLayer);
    }

    if (!countiesData) return;

    const color = countiesColor.value;
    const opacity = countiesOpacity.value / 100;
    const weight = parseInt(countiesWeight.value);

    countiesLayer = L.geoJSON(countiesData, {
        style: {
            color: color,
            weight: weight,
            fillColor: color,
            fillOpacity: opacity
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_1 || feature.properties.name;
            layer.bindTooltip(name, { sticky: true });

            layer.on({
                mouseover: (e) => highlightFeature(e, 'county'),
                mouseout: resetHighlight,
                click: (e) => showFeatureInfo(feature, 'County')
            });
        }
    });

    if (countiesToggle.checked) {
        countiesLayer.addTo(map);
    }
}

function updateCountiesStyle() {
    if (!countiesLayer) return;
    const color = countiesColor.value;
    const opacity = countiesOpacity.value / 100;
    const weight = parseInt(countiesWeight.value);
    countiesOpacityValue.textContent = countiesOpacity.value;
    countiesWeightValue.textContent = countiesWeight.value;
    countiesLayer.eachLayer(function(layer) {
        layer.setStyle({
            color: color,
            weight: weight,
            fillColor: color,
            fillOpacity: opacity
        });
    });
}

function createMunicipalitiesLayer() {
    if (municipalitiesLayer) {
        map.removeLayer(municipalitiesLayer);
    }

    if (!municipalitiesData) return;

    const color = municipalitiesColor.value;
    const opacity = municipalitiesOpacity.value / 100;
    const weight = parseInt(municipalitiesWeight.value);

    municipalitiesLayer = L.geoJSON(municipalitiesData, {
        style: {
            color: color,
            weight: weight,
            fillColor: color,
            fillOpacity: opacity,
            dashArray: '3'
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_2 || feature.properties.name;
            const county = feature.properties.NAME_1 || '';
            layer.bindTooltip(`${name}<br><small>${county}</small>`, { sticky: true });

            layer.on({
                mouseover: (e) => highlightFeature(e, 'municipality'),
                mouseout: resetHighlight,
                click: (e) => showFeatureInfo(feature, 'Municipality')
            });
        }
    });

    if (municipalitiesToggle.checked) {
        municipalitiesLayer.addTo(map);
    }
}

function updateMunicipalitiesStyle() {
    if (!municipalitiesLayer) return;
    const color = municipalitiesColor.value;
    const opacity = municipalitiesOpacity.value / 100;
    const weight = parseInt(municipalitiesWeight.value);
    municipalitiesOpacityValue.textContent = municipalitiesOpacity.value;
    municipalitiesWeightValue.textContent = municipalitiesWeight.value;
    municipalitiesLayer.eachLayer(function(layer) {
        layer.setStyle({
            color: color,
            weight: weight,
            fillColor: color,
            fillOpacity: opacity,
            dashArray: '3'
        });
    });
}

function highlightFeature(e, type) {
    const layer = e.target;

    // Increase weight by 2 on hover
    const baseWeight = type === 'county'
        ? parseInt(countiesWeight.value)
        : parseInt(municipalitiesWeight.value);

    layer.setStyle({
        weight: baseWeight + 2,
        fillOpacity: 0.3
    });

    layer.bringToFront();

    // Keep counties on top when highlighting municipalities
    if (type === 'municipality' && countiesLayer && countiesToggle.checked) {
        countiesLayer.bringToFront();
    }
}

function resetHighlight(e) {
    const layer = e.target;

    // Check which layer this belongs to and reset to current style
    if (countiesLayer && countiesLayer.hasLayer(layer)) {
        const color = countiesColor.value;
        const opacity = countiesOpacity.value / 100;
        const weight = parseInt(countiesWeight.value);
        layer.setStyle({
            color: color,
            weight: weight,
            fillColor: color,
            fillOpacity: opacity
        });
    } else if (municipalitiesLayer && municipalitiesLayer.hasLayer(layer)) {
        const color = municipalitiesColor.value;
        const opacity = municipalitiesOpacity.value / 100;
        const weight = parseInt(municipalitiesWeight.value);
        layer.setStyle({
            color: color,
            weight: weight,
            fillColor: color,
            fillOpacity: opacity,
            dashArray: '3'
        });
    }
}

// Check if a point is inside a polygon using ray-casting algorithm
function pointInPolygon(lat, lon, polygon) {
    const x = lon, y = lat;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

// Get all coordinates from a GeoJSON feature (handles MultiPolygon)
function getPolygonCoords(feature) {
    const geom = feature.geometry;
    const polygons = [];

    if (geom.type === 'Polygon') {
        // Polygon coordinates are [lon, lat]
        polygons.push(geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => {
            polygons.push(poly[0]);
        });
    }

    return polygons;
}

// Find data points within a feature
function findPointsInFeature(feature) {
    const polygons = getPolygonCoords(feature);
    const pointsInside = [];

    dataPoints.forEach(point => {
        for (const polygon of polygons) {
            if (pointInPolygon(point.lat, point.lon, polygon)) {
                pointsInside.push(point);
                break;
            }
        }
    });

    return pointsInside;
}

function showFeatureInfo(feature, type) {
    const props = feature.properties;
    let name, details;

    if (type === 'County') {
        name = props.NAME_1 || props.name;
        details = `<span style="color: #95a5a6;">Type: ${props.TYPE_1 || 'County'}</span>`;
    } else {
        name = props.NAME_2 || props.name;
        details = `<span style="color: #95a5a6;">County: ${props.NAME_1 || ''}</span>`;
    }

    // Find data points within this feature
    const pointsInside = findPointsInFeature(feature);

    // Build table HTML if there are points
    let tableHtml = '';
    if (pointsInside.length > 0) {
        tableHtml = `
            <div style="margin-top: 15px; max-height: 400px; overflow-y: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pointsInside.map(p => `
                            <tr>
                                <td>${p.nameTag || p.city}</td>
                                <td>${p.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #95a5a6;">
                Total: ${pointsInside.length} point${pointsInside.length !== 1 ? 's' : ''}
            </div>
        `;
    } else if (dataPoints.length > 0) {
        tableHtml = '<div style="margin-top: 15px; color: #95a5a6;">No data points in this area</div>';
    }

    // Show in modal (update if already open, otherwise reset position)
    modalTitle.innerHTML = `<strong>${name}</strong><br>${details}`;
    modalContent.innerHTML = tableHtml;

    if (!mapModal.classList.contains('show')) {
        resetModalPosition();
    }
    mapModal.classList.add('show');
}

// Close modal
function closeModal() {
    mapModal.classList.remove('show');
}

// Toggle sidebar
function toggleSidebar() {
    const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
    sidebarToggle.classList.toggle('collapsed', isCollapsed);
    sidebarToggle.textContent = isCollapsed ? '▶' : '◀';

    // Resize map to fill available space
    setTimeout(() => {
        map.invalidateSize();
    }, 350);
}

// Make modal draggable
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e) {
    if (e.target === modalClose) return;
    isDragging = true;

    const rect = mapModal.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Switch to left positioning for dragging
    mapModal.style.right = 'auto';
    mapModal.style.left = rect.left + 'px';
    mapModal.style.top = rect.top + 'px';

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
}

function doDrag(e) {
    if (!isDragging) return;

    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;

    // Keep within viewport bounds
    const maxX = window.innerWidth - mapModal.offsetWidth;
    const maxY = window.innerHeight - mapModal.offsetHeight;

    mapModal.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
    mapModal.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
}

function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// Reset modal position when opening
function resetModalPosition() {
    mapModal.style.transform = 'none';
    mapModal.style.left = 'auto';
    mapModal.style.right = '20px';
    mapModal.style.top = '80px';
}

// Toggle layer visibility
function toggleCounties() {
    if (countiesToggle.checked && countiesLayer) {
        countiesLayer.addTo(map);
    } else if (countiesLayer) {
        map.removeLayer(countiesLayer);
    }
}

function toggleMunicipalities() {
    if (municipalitiesToggle.checked && municipalitiesLayer) {
        municipalitiesLayer.addTo(map);
    } else if (municipalitiesLayer) {
        map.removeLayer(municipalitiesLayer);
    }
}

// ========== DATA POINTS FUNCTIONS ==========

// Add a single data point with label
function addDataPoint(lat, lon, city, date, gubernija = null, nameTag = null) {
    const color = gubernija ? getGubernijColor(gubernija) : '#e74c3c';
    const size = parseInt(dotSize.value);

    // Use nameTag for label if available, otherwise use date
    const labelText = nameTag || date;

    // Create circle marker for the dot
    const marker = L.circleMarker([lat, lon], {
        radius: size,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
    });

    // Create label above the dot (non-interactive so clicks pass through to dot)
    const label = L.marker([lat, lon], {
        interactive: false,
        icon: L.divIcon({
            className: 'data-label',
            html: `<div style="
                background: rgba(255,255,255,0.9);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                border: 1px solid ${color};
                transform: translateX(-50%);
                color: #333;
                pointer-events: none;
            ">${labelText}</div>`,
            iconSize: null,
            iconAnchor: [0, size + 15]
        })
    });

    // Bind popup with full info
    const popupContent = gubernija
        ? `<b>${city}</b><br>${gubernija} gubernija<br>${date}`
        : `<b>${city}</b><br>${date}`;
    marker.bindPopup(popupContent);

    // Add to layer
    marker.addTo(dataPointsLayer);
    label.addTo(dataPointsLayer);

    // Store reference
    dataPoints.push({ marker, label, city, date, lat, lon, gubernija, color, nameTag, labelText });
}

// Geocode a city name to get coordinates (tries multiple name variations)
async function geocodeCity(cityName) {
    const nameVariations = cleanPlaceName(cityName);

    for (const name of nameVariations) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `q=${encodeURIComponent(name + ', Lithuania')}` +
                `&format=json&limit=1`
            );
            const results = await response.json();

            if (results.length > 0) {
                console.log(`Found "${cityName}" as "${name}"`);
                return {
                    lat: parseFloat(results[0].lat),
                    lon: parseFloat(results[0].lon)
                };
            }

            // Small delay between retries
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error('Geocoding error:', error);
        }
    }

    return null;
}

// Format date - handle Excel serial numbers and keep text dates as-is
function formatDate(dateValue) {
    if (!dateValue) return '';

    const str = String(dateValue).trim();

    // If it's already a text date (contains - or ? or letters), keep it
    if (str.includes('-') || str.includes('?') || /[a-zA-Z]/.test(str)) {
        return str;
    }

    // If it's a number (Excel serial date), convert it
    const num = parseFloat(str);
    if (!isNaN(num) && num > 1000 && num < 100000) {
        // Excel serial date: days since 1899-12-30
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return str;
}

// Clean place name for geocoding (remove genitive endings, parentheticals, etc.)
function cleanPlaceName(name) {
    // Take first place if multiple are listed (separated by ir, ;, ,)
    let cleaned = name.split(/\s+ir\s+|;\s*|,\s*/)[0].trim();

    // Remove parenthetical notes
    cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();

    // Remove suffixes like "m.", "k.", "apygardos", "gub."
    cleaned = cleaned.replace(/\s+(m\.|k\.|apygardos|gub\.|Lietuviai)$/i, '').trim();

    // Convert genitive case endings to nominative for Lithuanian place names
    // Common patterns: -ų → -ai/-as/-a, -ių → -iai/-is/-ė, -os → -a
    const genitiveMap = [
        { ending: 'ių', replacements: ['iai', 'is', 'ė', 'ys'] },
        { ending: 'ų', replacements: ['ai', 'as', 'a', 'us', 'ys'] },
        { ending: 'os', replacements: ['a'] }
    ];

    for (const { ending, replacements } of genitiveMap) {
        if (cleaned.endsWith(ending)) {
            const base = cleaned.slice(0, -ending.length);
            // Return array of possible names to try
            return [cleaned, ...replacements.map(r => base + r)];
        }
    }

    return [cleaned];
}

// Import data from Excel/CSV file
async function importDataFile(file) {
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            // Use raw: true to prevent date conversion, read everything as strings
            const workbook = XLSX.read(data, { type: 'array', raw: true, codepage: 65001 });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });

            // Find header row and column indices
            let headerRowIdx = 0;
            let headers = rows[0];

            // Check if first row is header
            if (headers && headers.some(h => typeof h === 'string' &&
                (h.toLowerCase().includes('vals') || h.toLowerCase().includes('city') || h.toLowerCase().includes('gubern')))) {
                headerRowIdx = 0;
            }

            // Normalize headers to lowercase for matching
            const headerLower = headers.map(h => h ? String(h).toLowerCase().trim() : '');

            // Find column indices
            let cityIdx = headerLower.findIndex(h => h.includes('vals') || h.includes('city'));
            let gubernijaIdx = headerLower.findIndex(h => h.includes('gubern'));
            let dateIdx = headerLower.findIndex(h => h.includes('data') || h.includes('date'));
            let nameTagIdx = headerLower.findIndex(h => h.includes('name') || h.includes('tag') || h.includes('label'));

            // Fallback to positional if headers not found
            if (cityIdx === -1) cityIdx = 0;
            if (dateIdx === -1) dateIdx = gubernijaIdx === -1 ? 1 : 2;

            console.log('Column indices:', { cityIdx, gubernijaIdx, dateIdx, nameTagIdx });

            // Show loading
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay';
            loadingDiv.innerHTML = 'Importing data points...';
            document.body.appendChild(loadingDiv);

            let imported = 0;
            let failed = 0;
            const failedCities = [];

            for (let i = headerRowIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row[cityIdx]) continue;

                const city = String(row[cityIdx]).trim();
                const gubernija = gubernijaIdx !== -1 && row[gubernijaIdx] ? String(row[gubernijaIdx]).trim() : null;
                const date = formatDate(row[dateIdx]);
                const nameTag = nameTagIdx !== -1 && row[nameTagIdx] ? String(row[nameTagIdx]).trim() : null;

                // Skip empty rows
                if (!city) continue;

                loadingDiv.innerHTML = `Geocoding: ${city} (${imported + failed + 1}/${rows.length - headerRowIdx - 1})`;

                const coords = await geocodeCity(city);

                if (coords) {
                    addDataPoint(coords.lat, coords.lon, city, date, gubernija, nameTag);
                    imported++;
                } else {
                    console.warn(`Could not geocode: ${city}`);
                    failedCities.push(city);
                    failed++;
                }

                // Add delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            loadingDiv.remove();

            // Update legend
            updateGubernijLegend();

            let msg = `Imported ${imported} points.`;
            if (failed > 0) {
                msg += `\nFailed: ${failed}`;
                console.log('Failed cities:', failedCities);
            }
            alert(msg);

        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing file: ' + error.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

// Update gubernija legend
function updateGubernijLegend() {
    const usedGubernijos = [...new Set(dataPoints.map(p => p.gubernija).filter(g => g))];

    if (usedGubernijos.length === 0) {
        pointsCount.innerHTML = `Points loaded: ${dataPoints.length}`;
        return;
    }

    let legendHtml = '<div style="margin-top: 10px;"><b>Legend:</b></div>';
    usedGubernijos.forEach(gub => {
        const color = getGubernijColor(gub);
        const count = dataPoints.filter(p => p.gubernija === gub).length;
        legendHtml += `<div style="display: flex; align-items: center; margin-top: 5px;">
            <span style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 8px;"></span>
            <span>${gub} (${count})</span>
        </div>`;
    });

    pointsCount.innerHTML = `Points loaded: ${dataPoints.length}${legendHtml}`;
}

// Update data points style (size only, preserve gubernija colors)
function updateDataPointsStyle() {
    const size = parseInt(dotSize.value);
    dotSizeValue.textContent = size;

    dataPoints.forEach(point => {
        const color = point.color || '#e74c3c';

        point.marker.setStyle({
            radius: size
        });

        // Update label position
        point.label.setIcon(L.divIcon({
            className: 'data-label',
            html: `<div style="
                background: rgba(255,255,255,0.9);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                border: 1px solid ${color};
                transform: translateX(-50%);
                color: #333;
                pointer-events: none;
            ">${point.labelText}</div>`,
            iconSize: null,
            iconAnchor: [0, size + 15]
        }));
    });
}

// Clear all data points
function clearDataPoints() {
    dataPointsLayer.clearLayers();
    dataPoints = [];
    pointsCount.innerHTML = '';
}


// ========== LOCATION SEARCH FUNCTIONS ==========

async function searchLocation(query) {
    if (query.length < 2) {
        searchResults.innerHTML = '';
        return;
    }

    searchResults.innerHTML = '<div class="loading">Searching...</div>';

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)}` +
            `&format=json` +
            `&limit=10` +
            `&addressdetails=1` +
            `&extratags=1`
        );

        const results = await response.json();

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="loading">No results found</div>';
            return;
        }

        displaySearchResults(results);
    } catch (error) {
        searchResults.innerHTML = '<div class="loading">Error searching</div>';
        console.error('Search error:', error);
    }
}

function displaySearchResults(results) {
    searchResults.innerHTML = '';

    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result-item';

        const parts = result.display_name.split(',');
        const shortName = parts.slice(0, 3).join(',');

        div.innerHTML = `
            <div><strong>${result.name}</strong></div>
            <small>${shortName}</small>
        `;

        div.onclick = () => selectSearchResult(result);
        searchResults.appendChild(div);
    });
}

function selectSearchResult(result) {
    selectedLocation = {
        name: result.name,
        displayName: result.display_name,
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        boundingbox: result.boundingbox,
        type: result.type,
        osmType: result.osm_type
    };

    locationSearch.value = result.name;
    searchResults.innerHTML = '';

    if (result.boundingbox) {
        const bounds = [
            [parseFloat(result.boundingbox[0]), parseFloat(result.boundingbox[2])],
            [parseFloat(result.boundingbox[1]), parseFloat(result.boundingbox[3])]
        ];
        map.fitBounds(bounds);
    } else {
        map.setView([selectedLocation.lat, selectedLocation.lon], 10);
    }
}

function createLocationOverlay(location, color, borderOnly) {
    if (location.boundingbox && location.boundingbox.length === 4) {
        const bounds = [
            [parseFloat(location.boundingbox[0]), parseFloat(location.boundingbox[2])],
            [parseFloat(location.boundingbox[1]), parseFloat(location.boundingbox[3])]
        ];

        const latDiff = Math.abs(bounds[1][0] - bounds[0][0]);
        const lonDiff = Math.abs(bounds[1][1] - bounds[0][1]);

        if (latDiff > 0.5 || lonDiff > 0.5) {
            const rectangle = L.rectangle(bounds, {
                color: color,
                fillColor: color,
                fillOpacity: borderOnly ? 0 : 0.3,
                weight: borderOnly ? 4 : 2
            });
            rectangle.bindPopup(`<b>${location.name}</b><br><small>${location.displayName}</small>`);
            return rectangle;
        }
    }

    const radius = getRadiusForType(location.type);
    const circle = L.circle([location.lat, location.lon], {
        color: color,
        fillColor: color,
        fillOpacity: borderOnly ? 0 : 0.5,
        radius: radius,
        weight: borderOnly ? 4 : 2
    });

    circle.bindPopup(`<b>${location.name}</b><br><small>${location.displayName}</small>`);
    return circle;
}

function getRadiusForType(type) {
    const radiusMap = {
        'city': 10000,
        'town': 5000,
        'village': 2000,
        'suburb': 3000,
        'municipality': 8000,
        'country': 100000,
        'state': 50000,
        'region': 40000
    };

    return radiusMap[type] || 5000;
}

function applySelection() {
    if (!selectedLocation) {
        alert('Please search and select a location first');
        return;
    }

    const color = colorPicker.value;
    const borderOnly = borderOnlyCheckbox.checked;
    const locationKey = selectedLocation.name;

    if (layers[locationKey]) {
        map.removeLayer(layers[locationKey]);
    }

    const layer = createLocationOverlay(selectedLocation, color, borderOnly);

    if (layer) {
        layer.addTo(map);
        layers[locationKey] = layer;
        selectedRegions[locationKey] = {
            location: selectedLocation,
            color: color,
            borderOnly: borderOnly
        };
        updateSelectedList();
    }
}

function updateSelectedList() {
    selectedList.innerHTML = '<h3 style="margin-top: 20px; margin-bottom: 10px;">Selected Regions</h3>';

    Object.keys(selectedRegions).forEach(name => {
        const item = selectedRegions[name];
        const div = document.createElement('div');
        div.className = 'selected-item';

        const styleAttr = item.borderOnly
            ? `border: 3px solid ${item.color}; background-color: transparent;`
            : `background-color: ${item.color}`;

        div.innerHTML = `
            <div class="color-indicator" style="${styleAttr}"></div>
            <div class="item-info">
                <div><strong>${name}</strong></div>
                <small style="color: #95a5a6;">${item.location.type}${item.borderOnly ? ' (border)' : ''}</small>
            </div>
        `;
        selectedList.appendChild(div);
    });
}

// ========== DRAWING TOOLS FUNCTIONS ==========

function deactivateAllDrawTools() {
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    drawingControls.style.display = 'none';
    textControls.style.display = 'none';
    currentDrawMode = null;
    deleteMode = false;
    deleteModeBtn.classList.remove('active');
    map.off('click');
    map.getContainer().style.cursor = '';
}

function activateDrawTool(toolName, button) {
    deactivateAllDrawTools();
    currentDrawMode = toolName;
    button.classList.add('active');

    if (toolName !== 'text') {
        drawingControls.style.display = 'block';
    }
}

// Arrow drawing (polyline with arrowhead)
function startArrowDraw() {
    let points = [];

    const clickHandler = (e) => {
        L.DomEvent.stopPropagation(e);
        points.push(e.latlng);

        if (points.length === 1) {
            map.getContainer().style.cursor = 'crosshair';
        } else if (points.length === 2) {
            // Create arrow line
            const arrow = L.polyline(points, {
                color: drawColor.value,
                weight: parseInt(drawWidth.value),
                opacity: 0.8
            });

            // Calculate angle for arrowhead
            const p1 = map.latLngToLayerPoint(points[0]);
            const p2 = map.latLngToLayerPoint(points[1]);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

            // Create arrowhead marker at end point
            const arrowIcon = L.divIcon({
                className: '',
                html: `<div style="
                    width: 0;
                    height: 0;
                    border-left: 10px solid transparent;
                    border-right: 10px solid transparent;
                    border-bottom: 20px solid ${drawColor.value};
                    transform: rotate(${angle + 90}deg);
                    transform-origin: 50% 66%;
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 13]
            });

            const arrowHead = L.marker(points[1], { icon: arrowIcon });

            arrow.addTo(drawnItems);
            arrowHead.addTo(drawnItems);
            setupDeleteOnClick(arrow);
            setupDeleteOnClick(arrowHead);

            points = [];
            map.getContainer().style.cursor = '';
            deactivateAllDrawTools();
        }
    };

    map.on('click', clickHandler);
}

// Line drawing
function startLineDraw() {
    let points = [];

    const clickHandler = (e) => {
        L.DomEvent.stopPropagation(e);
        points.push(e.latlng);

        if (points.length === 1) {
            map.getContainer().style.cursor = 'crosshair';
        } else if (points.length === 2) {
            const line = L.polyline(points, {
                color: drawColor.value,
                weight: parseInt(drawWidth.value),
                opacity: 0.8
            });

            line.addTo(drawnItems);
            setupDeleteOnClick(line);

            points = [];
            map.getContainer().style.cursor = '';
            deactivateAllDrawTools();
        }
    };

    map.on('click', clickHandler);
}

// Circle drawing
function startCircleDraw() {
    let center = null;

    const clickHandler = (e) => {
        L.DomEvent.stopPropagation(e);
        if (!center) {
            center = e.latlng;
            map.getContainer().style.cursor = 'crosshair';
        } else {
            const radius = center.distanceTo(e.latlng);
            const circle = L.circle(center, {
                radius: radius,
                color: drawColor.value,
                fillColor: drawColor.value,
                fillOpacity: 0.3,
                weight: parseInt(drawWidth.value)
            });

            circle.addTo(drawnItems);
            setupDeleteOnClick(circle);

            center = null;
            map.getContainer().style.cursor = '';
            deactivateAllDrawTools();
        }
    };

    map.on('click', clickHandler);
}

// Rectangle drawing
function startRectangleDraw() {
    let corner1 = null;

    const clickHandler = (e) => {
        L.DomEvent.stopPropagation(e);
        if (!corner1) {
            corner1 = e.latlng;
            map.getContainer().style.cursor = 'crosshair';
        } else {
            const bounds = L.latLngBounds(corner1, e.latlng);
            const rectangle = L.rectangle(bounds, {
                color: drawColor.value,
                fillColor: drawColor.value,
                fillOpacity: 0.3,
                weight: parseInt(drawWidth.value)
            });

            rectangle.addTo(drawnItems);
            setupDeleteOnClick(rectangle);

            corner1 = null;
            map.getContainer().style.cursor = '';
            deactivateAllDrawTools();
        }
    };

    map.on('click', clickHandler);
}

// Polygon drawing
function startPolygonDraw() {
    let points = [];
    let tempPolyline = null;

    const clickHandler = (e) => {
        L.DomEvent.stopPropagation(e);

        // Check if clicking near first point to finish (if we have at least 3 points)
        if (points.length >= 3) {
            const firstPoint = points[0];
            const pixelDistance = map.latLngToLayerPoint(e.latlng).distanceTo(map.latLngToLayerPoint(firstPoint));

            if (pixelDistance < 20) {
                // Finish the polygon
                if (tempPolyline) {
                    drawnItems.removeLayer(tempPolyline);
                }

                const polygon = L.polygon(points, {
                    color: drawColor.value,
                    fillColor: drawColor.value,
                    fillOpacity: 0.3,
                    weight: parseInt(drawWidth.value)
                });

                polygon.addTo(drawnItems);
                setupDeleteOnClick(polygon);

                points = [];
                tempPolyline = null;
                map.getContainer().style.cursor = '';
                map.off('click', clickHandler);
                deactivateAllDrawTools();
                return;
            }
        }

        // Add point
        points.push(e.latlng);

        if (points.length === 1) {
            map.getContainer().style.cursor = 'crosshair';
        } else {
            // Update temp polyline to show progress
            if (tempPolyline) {
                drawnItems.removeLayer(tempPolyline);
            }
            tempPolyline = L.polyline(points, {
                color: drawColor.value,
                weight: parseInt(drawWidth.value),
                opacity: 0.5,
                dashArray: '5, 5'
            });
            tempPolyline.addTo(drawnItems);
        }
    };

    map.on('click', clickHandler);
    alert('Click to add points. Click near the first point to finish (need at least 3 points).');
}

// Text marker
function activateTextMode() {
    textControls.style.display = 'block';
    addTextBtn.classList.add('active');
}

function placeText() {
    const text = textInput.value.trim();
    if (!text) {
        alert('Please enter some text');
        return;
    }

    const clickHandler = (e) => {
        L.DomEvent.stopPropagation(e);

        const icon = L.divIcon({
            className: 'text-marker',
            html: `<div style="
                background: white;
                padding: 5px 10px;
                border-radius: 4px;
                border: 2px solid ${drawColor.value};
                font-size: ${textSize.value}px;
                font-weight: bold;
                white-space: nowrap;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                color: #2c3e50;
            ">${text}</div>`,
            iconSize: null
        });

        const marker = L.marker(e.latlng, { icon: icon });
        marker.addTo(drawnItems);
        setupDeleteOnClick(marker);
        textMarkers.push(marker);

        map.off('click', clickHandler);
        deactivateAllDrawTools();
    };

    map.on('click', clickHandler);
    alert('Click on the map to place your text');
}

// Delete mode
function toggleDeleteMode() {
    deleteMode = !deleteMode;

    if (deleteMode) {
        deleteModeBtn.classList.add('active');
        map.getContainer().style.cursor = 'pointer';
        alert('Click on any drawing to delete it');
    } else {
        deleteModeBtn.classList.remove('active');
        map.getContainer().style.cursor = '';
    }
}

function setupDeleteOnClick(layer) {
    layer.on('click', function(e) {
        if (deleteMode) {
            drawnItems.removeLayer(layer);
            L.DomEvent.stopPropagation(e);
        }
    });
}

// Clear all
function clearAll() {
    // Clear location highlights
    Object.keys(layers).forEach(name => {
        map.removeLayer(layers[name]);
    });
    layers = {};
    selectedRegions = {};
    selectedList.innerHTML = '';
    selectedLocation = null;
    locationSearch.value = '';
    searchResults.innerHTML = '';

    // Clear drawings
    drawnItems.clearLayers();
    textMarkers = [];

    // Reset map to Lithuania
    map.setView(lithuaniaCenter, 8);
    deactivateAllDrawTools();

    // Hide layer info
    layerInfo.style.display = 'none';
}

// ========== EVENT LISTENERS ==========

// Location search
locationSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchLocation(e.target.value);
    }, 500);
});

applyBtn.addEventListener('click', applySelection);

// Drawing tools
drawArrowBtn.addEventListener('click', () => {
    activateDrawTool('arrow', drawArrowBtn);
    startArrowDraw();
});

drawLineBtn.addEventListener('click', () => {
    activateDrawTool('line', drawLineBtn);
    startLineDraw();
});

drawCircleBtn.addEventListener('click', () => {
    activateDrawTool('circle', drawCircleBtn);
    startCircleDraw();
});

drawRectangleBtn.addEventListener('click', () => {
    activateDrawTool('rectangle', drawRectangleBtn);
    startRectangleDraw();
});

drawPolygonBtn.addEventListener('click', () => {
    activateDrawTool('polygon', drawPolygonBtn);
    startPolygonDraw();
});

addTextBtn.addEventListener('click', activateTextMode);
placeTextBtn.addEventListener('click', placeText);

cancelDrawBtn.addEventListener('click', deactivateAllDrawTools);
deleteModeBtn.addEventListener('click', toggleDeleteMode);
clearBtn.addEventListener('click', clearAll);

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#location-search') && !e.target.closest('#search-results')) {
        searchResults.innerHTML = '';
    }
});

// Prevent right-click menu on map (for polygon finishing)
map.getContainer().addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Leaflet Polyline Decorator for arrows
// Create L.Symbol namespace if it doesn't exist
if (!L.Symbol) {
    L.Symbol = {};
}

L.Symbol.ArrowHead = L.Path.extend({
    options: {
        polygon: true,
        pixelSize: 10,
        headAngle: 60,
        pathOptions: {
            stroke: true,
            weight: 2
        }
    },

    initialize: function(options) {
        L.setOptions(this, options);
        this._createArrowHead();
    },

    _createArrowHead: function() {
        const size = this.options.pixelSize;
        const angle = this.options.headAngle;
        this._path = '';
    }
});

L.Symbol.arrowHead = function(options) {
    return new L.Symbol.ArrowHead(options);
};

L.PolylineDecorator = L.FeatureGroup.extend({
    options: {
        patterns: []
    },

    initialize: function(paths, options) {
        L.FeatureGroup.prototype.initialize.call(this);
        L.setOptions(this, options);
        this._paths = [].concat(paths);
        this._initPatterns();
    },

    _initPatterns: function() {
        this._patterns = [];
        const patterns = this.options.patterns;

        for (let i = 0; i < patterns.length; i++) {
            this._patterns.push(this._parsePattern(patterns[i]));
        }
    },

    _parsePattern: function(pattern) {
        return {
            offset: this._parseValue(pattern.offset),
            repeat: this._parseValue(pattern.repeat),
            symbol: pattern.symbol
        };
    },

    _parseValue: function(value) {
        if (typeof value === 'string' && value.indexOf('%') !== -1) {
            return parseFloat(value) / 100;
        }
        return parseFloat(value);
    },

    onAdd: function(map) {
        this._map = map;
        this._draw();
        this._paths.forEach(path => {
            if (path._path) {
                this._map.on('zoomend', this._draw, this);
            }
        });
    },

    _draw: function() {
        this.clearLayers();
        this._paths.forEach(path => {
            const pathLatLngs = path.getLatLngs();
            if (pathLatLngs.length < 2) return;

            this._patterns.forEach(pattern => {
                const symbol = pattern.symbol;
                const positions = this._getPositions(pathLatLngs, pattern);

                positions.forEach(pos => {
                    const marker = this._createSymbol(symbol, pos);
                    if (marker) {
                        this.addLayer(marker);
                    }
                });
            });
        });
    },

    _getPositions: function(latLngs, pattern) {
        const positions = [];
        if (latLngs.length < 2) return positions;

        // For 100% offset (end of line), just return the last point
        if (pattern.offset >= 1 || pattern.offset === '100%') {
            const lastIdx = latLngs.length - 1;
            const angle = this._getAngle(latLngs[lastIdx - 1], latLngs[lastIdx]);
            positions.push({
                latLng: latLngs[lastIdx],
                angle: angle
            });
        }

        return positions;
    },

    _getAngle: function(latLng1, latLng2) {
        const point1 = this._map.latLngToLayerPoint(latLng1);
        const point2 = this._map.latLngToLayerPoint(latLng2);
        return Math.atan2(point2.y - point1.y, point2.x - point1.x) * 180 / Math.PI;
    },

    _createSymbol: function(symbol, pos) {
        const options = symbol.options;
        const size = options.pixelSize;

        const icon = L.divIcon({
            className: '',
            html: `<div style="
                width: 0;
                height: 0;
                border-left: ${size}px solid transparent;
                border-right: ${size}px solid transparent;
                border-bottom: ${size * 1.5}px solid ${options.pathOptions.color};
                opacity: ${options.pathOptions.fillOpacity || 1};
                transform: rotate(${pos.angle + 90}deg);
                transform-origin: 50% 66%;
            "></div>`,
            iconSize: [size * 2, size * 2],
            iconAnchor: [size, size * 1.33]
        });

        return L.marker(pos.latLng, { icon: icon });
    }
});

L.polylineDecorator = function(paths, options) {
    return new L.PolylineDecorator(paths, options);
};

// ========== ADMINISTRATIVE LAYER EVENT LISTENERS ==========

countiesToggle.addEventListener('change', toggleCounties);
municipalitiesToggle.addEventListener('change', toggleMunicipalities);

// Use 'input' event for real-time color, opacity, and weight updates
countiesColor.addEventListener('input', updateCountiesStyle);
municipalitiesColor.addEventListener('input', updateMunicipalitiesStyle);
countiesOpacity.addEventListener('input', updateCountiesStyle);
municipalitiesOpacity.addEventListener('input', updateMunicipalitiesStyle);
countiesWeight.addEventListener('input', updateCountiesStyle);
municipalitiesWeight.addEventListener('input', updateMunicipalitiesStyle);

// Also handle 'change' event for when picker closes
countiesColor.addEventListener('change', updateCountiesStyle);
municipalitiesColor.addEventListener('change', updateMunicipalitiesStyle);

// ========== DATA POINTS EVENT LISTENERS ==========

fileImport.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importDataFile(e.target.files[0]);
    }
});

dotSize.addEventListener('input', updateDataPointsStyle);
clearPointsBtn.addEventListener('click', clearDataPoints);

// ========== SIDEBAR AND MODAL EVENT LISTENERS ==========

sidebarToggle.addEventListener('click', toggleSidebar);
modalClose.addEventListener('click', closeModal);
modalHeader.addEventListener('mousedown', startDrag);

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// Load administrative boundaries on page load
loadAdministrativeLayers();

// Resize map on load since sidebar starts collapsed
setTimeout(() => map.invalidateSize(), 100);

// Auto-load pre-geocoded data from JSON (instant load, no geocoding needed)
async function loadDefaultData() {
    try {
        const response = await fetch('data-points.json');
        if (!response.ok) {
            console.log('Pre-geocoded data not found');
            return;
        }

        const points = await response.json();

        points.forEach(point => {
            addDataPoint(point.lat, point.lon, point.city, point.date, point.gubernija, point.nameTag);
        });

        updateGubernijLegend();
        console.log(`Loaded ${points.length} pre-geocoded points`);

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Load default data immediately
loadDefaultData();
