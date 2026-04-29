import { Capacitor } from '@capacitor/core';
import './style.css';
import L from 'leaflet';
import { DEFAULT_POIS } from './data/pois';
import type { POI, POICategory } from './models/poi';
import { EVENTS_DATA } from './data/events';
import { CATEGORY_EMOJIS } from './data/categories';
import { RAINY_PLANS } from './data/rainy_plans';

// EVENTS moved to data/events.ts; imported as EVENTS_DATA

const calculateTidesForDate = (date: Date) => {
  // Referencia: Una marea alta en Bueu (aprox) el 01-04-2024 a las 03:00
  const epoch = new Date('2024-04-01T03:00:00').getTime();
  const current = date.getTime();
  const diffHours = (current - epoch) / (1000 * 60 * 60);

  // El periodo de marea alta es de ~12.42 horas
  const tideCycle = 12.42;
  const cyclesSinceEpoch = diffHours / tideCycle;
  const cycleFraction = cyclesSinceEpoch - Math.floor(cyclesSinceEpoch);

  // Calcular la próxima marea alta desde ahora
  const hoursToNextHigh = (1 - cycleFraction) * tideCycle;
  const nextHigh = new Date(current + hoursToNextHigh * 60 * 60 * 1000);
  const nextLow = new Date(nextHigh.getTime() - (tideCycle / 2) * 60 * 60 * 1000);

  return {
    high: nextHigh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    low: nextLow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// CATEGORY_EMOJIS now defined in data/categories.ts and imported as CATEGORY_EMOJIS

// DEFAULT_POIS now imported from src/data/pois.ts
document.addEventListener('DOMContentLoaded', () => {
  // --- 0. Lógica de Pantalla de Inicio (Splash Screen) ---
  const splashScreen = document.getElementById('splash-screen');
  const splashVideo = document.getElementById('splash-video') as HTMLVideoElement;
  const splashSkip = document.getElementById('splash-skip');

  let hideSplash = () => {
    if (splashScreen) {
      splashScreen.classList.add('hidden');
      if (splashVideo) splashVideo.pause();
    }
  };

  if (splashVideo) {
    // Intentar reproducción inmediata con sonido
    splashVideo.muted = false;
    splashVideo.volume = 1.0;
    
    const tryPlay = () => {
      splashVideo.play().catch(e => {
        console.warn("Autoplay bloqueado por el navegador:", e);
        // Si falla, al menos lo dejamos en espera de un click como fallback
        document.addEventListener('click', () => {
          splashVideo.muted = false;
          splashVideo.play();
        }, { once: true });
      });
    };

    tryPlay();

    // En APK nativa ya está configurado para permitirlo
    if (Capacitor.isNativePlatform()) {
      splashVideo.muted = false;
      splashVideo.play().catch(() => {});
    }

    splashVideo.addEventListener('ended', hideSplash);
  }
  
  if (splashSkip) {
    splashSkip.addEventListener('click', () => {
      hideSplash();
    });
  }

  // --- 1. Inicialización del Mapa (Modo Satélite Profesional) ---
  const initialPoi = DEFAULT_POIS.find(p => p.id === 'poi-amiudina') || DEFAULT_POIS[0];
  const mapCenter: L.LatLngTuple = initialPoi ? [initialPoi.lat, initialPoi.lng] : [42.3333, -8.8]; 
  
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    maxBounds: L.latLngBounds([42.2, -8.9], [42.4, -8.7]), // Limitar a la zona de Beluso/Bueu
    minZoom: 12
  }).setView(mapCenter, 16);

  // Google Maps Hybrid (Satélite con etiquetas de calles y lugares)
  // lyrs=y: Híbrido, lyrs=s: Satélite puro, lyrs=m: Mapa normal
  const satelliteLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  }).addTo(map);

  // Eliminado el selector de capas para un diseño más limpio y profesional
  const layersContainer = document.getElementById('map-layers-container');
  if (layersContainer) {
    layersContainer.style.display = 'none';
  }

  // --- 2. Gestión de Estado y Datos ---
  const STORAGE_KEY = 'beluso_pois_v2';
  const ROUTE_STORAGE_KEY = 'beluso_saved_route_v1';
  const MULTI_ROUTES_KEY = 'beluso_multi_routes_v2';
  const FAVORITES_KEY = 'beluso_favorites_v1';

  let pois: POI[] = [...DEFAULT_POIS];
  let favorites: string[] = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  let savedRoutes: { name: string, pois: string[] }[] = JSON.parse(localStorage.getItem(MULTI_ROUTES_KEY) || '[]');

  let markers: { [id: string]: L.Marker } = {};
  let isAdmin = false;
  let isRouteMode = false;
  let customRoutePoints: POI[] = [];
  let routePolyline: L.Polyline | null = null;
  let routeOutlinePolyline: L.Polyline | null = null;

  const routeOverlay = document.getElementById('route-overlay') as HTMLElement;
  const routeTotalDist = document.getElementById('route-total-distance') as HTMLElement;
  const btnClearRoute = document.getElementById('btn-clear-route') as HTMLButtonElement;
  const btnSaveRouteUI = document.getElementById('btn-save-route-ui') as HTMLButtonElement;
  const btnListRoutes = document.getElementById('btn-list-routes') as HTMLButtonElement;
  const btnShareRoute = document.getElementById('btn-share-route') as HTMLButtonElement;
  const btnLocateMe = document.getElementById('btn-locate-me') as HTMLButtonElement;

  // --- 2.0 Lógica de Geolocalización del Usuario ---
  let userMarker: L.Marker | null = null;
  let isFirstLocation = true;
  let prevLat = 0;
  let prevLng = 0;
  let currentDirection = 'abajo';

  const updateUserLocation = (pos: GeolocationPosition, forceCenter = false) => {
    const { latitude, longitude } = pos.coords;
    const latlng = L.latLng(latitude, longitude);

    if (prevLat !== 0 && prevLng !== 0) {
      const dLat = latitude - prevLat;
      const dLng = longitude - prevLng;
      if (Math.abs(dLat) > 0.00001 || Math.abs(dLng) > 0.00001) {
        if (Math.abs(dLat) > Math.abs(dLng)) {
          currentDirection = dLat > 0 ? 'arriba' : 'abajo';
        } else {
          currentDirection = dLng > 0 ? 'derecha' : 'izquierda';
        }
      }
    }
    prevLat = latitude;
    prevLng = longitude;

    const iconHtml = `<img src="/assets/Animacion/belusin_camina_${currentDirection}.gif" style="width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.5));" />`;

    if (!userMarker) {
      const userIcon = L.divIcon({
        className: 'user-location-marker-container',
        html: iconHtml,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });
      userMarker = L.marker(latlng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      userMarker.setLatLng(latlng);
      const currentIcon = userMarker.getIcon() as L.DivIcon;
      if (currentIcon.options.html !== iconHtml) {
        userMarker.setIcon(L.divIcon({
          className: 'user-location-marker-container',
          html: iconHtml,
          iconSize: [50, 50],
          iconAnchor: [25, 25]
        }));
      }
    }

    if (isFirstLocation || forceCenter) {
      map.setView(latlng, 17, { animate: true });
      isFirstLocation = false;
    }
  };

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      updateUserLocation,
      (err) => console.warn('Error GPS:', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  // --- Simulación de Movimiento para pruebas (Teclado) ---
  let simLat = mapCenter[0];
  let simLng = mapCenter[1];
  window.addEventListener('keydown', (e) => {
    const step = 0.00005; // Ajuste de velocidad
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (userMarker) {
        simLat = userMarker.getLatLng().lat;
        simLng = userMarker.getLatLng().lng;
      }
      if (e.key === 'ArrowUp') simLat += step;
      if (e.key === 'ArrowDown') simLat -= step;
      if (e.key === 'ArrowLeft') simLng -= step;
      if (e.key === 'ArrowRight') simLng += step;
      
      const fakePos = {
        coords: {
          latitude: simLat,
          longitude: simLng,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      } as GeolocationPosition;
      
      updateUserLocation(fakePos, true);
    }
  });

  btnLocateMe?.addEventListener('click', function() {
    if (userMarker) {
      map.setView(userMarker.getLatLng(), 17, { animate: true });
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => updateUserLocation(pos, true),
        (err) => {
          let msg = 'No se pudo obtener tu ubicación.';
          if (err.code === 1) msg = 'Permiso denegado. Activa el GPS o los permisos en la configuración de tu navegador/móvil.';
          else if (err.code === 2) msg = 'Ubicación no disponible en este dispositivo.';
          else if (err.code === 3) msg = 'Tiempo de espera agotado al buscar el GPS.';
          alert(msg);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: Infinity }
      );
    }
  });


  // --- 2.1 Gestión de Diseño Draggable ---
  const LAYOUT_KEY = 'beluso_ui_layout_v1';
  let uiLayout: { [id: string]: { top: string; left: string } } = {};

  const saveLayout = () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(uiLayout));
  };

  const loadLayout = () => {
    const data = localStorage.getItem(LAYOUT_KEY);
    if (data) {
      uiLayout = JSON.parse(data);
      Object.keys(uiLayout).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.style.top = uiLayout[id].top;
          el.style.left = uiLayout[id].left;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        }
      });
    }
  };

  const makeDraggable = (el: HTMLElement) => {
    let isDragging = false;
    let startX: number, startY: number, initialX: number, initialY: number;

    const onStart = (e: MouseEvent | TouchEvent) => {
      if (!isAdmin) return;
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      startX = clientX;
      startY = clientY;
      
      const rect = el.getBoundingClientRect();
      const parentRect = document.getElementById('app')!.getBoundingClientRect();
      initialX = rect.left - parentRect.left;
      initialY = rect.top - parentRect.top;
      
      el.style.zIndex = '5000';
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const dx = clientX - startX;
      const dy = clientY - startY;
      
      el.style.top = `${initialY + dy}px`;
      el.style.left = `${initialX + dx}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.zIndex = '1000';
      uiLayout[el.id] = { top: el.style.top, left: el.style.left };
      saveLayout();
    };

    el.addEventListener('mousedown', onStart);
    el.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  };

  const widget = document.getElementById('weather-widget');
  const layers = document.getElementById('map-layers-container');
  // Header variable removed because it was unused

  if (widget) makeDraggable(widget);
  if (layers) makeDraggable(layers);

  loadLayout();

  const savePOIs = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pois));
  };

  const renderMarkers = () => {
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    pois.forEach(poi => {
      // Filtering by category removed; show all POIs
      const emoji = CATEGORY_EMOJIS[poi.category] || CATEGORY_EMOJIS['generico'];
      const icon = L.divIcon({
        className: `emoji-marker ${poi.category}`,
        html: `<span>${emoji}</span>`,
        iconSize: [44, 44],
        iconAnchor: [22, 50]
      });

      const marker = L.marker([poi.lat, poi.lng], {
        icon,
        draggable: isAdmin
      }).addTo(map);

      marker.on('click', () => {
        openBottomSheet(poi);
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        poi.lat = newPos.lat;
        poi.lng = newPos.lng;
        const latInput = document.getElementById('poi-lat') as HTMLInputElement;
        const lngInput = document.getElementById('poi-lng') as HTMLInputElement;
        if (latInput && lngInput) {
          latInput.value = newPos.lat.toString();
          lngInput.value = newPos.lng.toString();
        }
        savePOIs();
      });

      markers[poi.id] = marker;
    });
  };

  // --- 3. Navegación Inferior e Interfaz de Detalles (Bottom Sheet) ---
  const bottomSheet = document.getElementById('bottom-sheet') as HTMLElement;
  const poiTitle = document.getElementById('poi-name') as HTMLElement;
  const poiDesc = document.getElementById('poi-desc') as HTMLElement;
  const poiImg = document.getElementById('poi-img') as HTMLImageElement;
  const poiVid = document.getElementById('poi-vid') as HTMLVideoElement;
  const btnAction = document.getElementById('btn-action') as HTMLButtonElement;
  const poiMedia = document.getElementById('poi-media') as HTMLElement;
  const carouselPrev = document.getElementById('carousel-prev') as HTMLButtonElement;
  const carouselNext = document.getElementById('carousel-next') as HTMLButtonElement;
  const carouselCounter = document.getElementById('carousel-counter') as HTMLElement;
  const poiDistance = document.getElementById('poi-distance') as HTMLElement;
  const btnGoogleMaps = document.getElementById('btn-google-maps') as HTMLButtonElement;
  const btnToggleFavorite = document.getElementById('btn-toggle-favorite') as HTMLButtonElement;
  const btnCloseBottomSheet = document.getElementById('btn-close-bottom-sheet') as HTMLButtonElement;

  const closeBottomSheet = () => {
    bottomSheet.classList.remove('open');
  };

  btnCloseBottomSheet?.addEventListener('click', closeBottomSheet);

  const updateFavoriteButton = (poiId: string) => {
    if (!btnToggleFavorite) return;
    const isFav = favorites.includes(poiId);
    btnToggleFavorite.innerText = isFav ? '❤️' : '🤍';
    btnToggleFavorite.style.background = isFav ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.05)';
  };

  const toggleFavorite = (poiId: string) => {
    if (favorites.includes(poiId)) {
      favorites = favorites.filter(id => id !== poiId);
    } else {
      favorites.push(poiId);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    updateFavoriteButton(poiId);
  };

  const openBottomSheet = (poi: POI) => {
    if (!poiTitle || !poiDesc || !poiMedia) return;

    poiTitle.innerText = poi.name;
    poiDesc.innerText = poi.description;

    const poiCarousel = document.getElementById('poi-carousel') as HTMLElement;
    poiVid.pause();

    // Reiniciar carrusel y flechas
    if (poiCarousel) {
      poiCarousel.style.display = 'none';
      poiCarousel.innerHTML = '';
    }
    if (carouselPrev) carouselPrev.style.display = 'none';
    if (carouselNext) carouselNext.style.display = 'none';
    if (carouselCounter) carouselCounter.style.display = 'none';

    if (poi.vidUrl && poi.vidUrl.trim() !== '') {
      poiImg.style.display = 'none';
      poiVid.style.display = 'block';
      poiVid.src = poi.vidUrl;
      poiVid.play().catch(() => { });
    } else if (poi.imgUrls && poi.imgUrls.length > 0) {
      poiVid.style.display = 'none';
      poiImg.style.display = 'none';
      if (poiCarousel) {
        poiCarousel.style.display = 'flex';
        poiCarousel.innerHTML = poi.imgUrls.map(url => `<img src="${encodeURI(url)}" style="min-width: 100%; height: 100%; object-fit: cover; scroll-snap-align: start;" />`).join('');

        if (poi.imgUrls.length > 1) {
          if (carouselPrev) carouselPrev.style.display = 'flex';
          if (carouselNext) carouselNext.style.display = 'flex';

          if (carouselCounter) {
            carouselCounter.style.display = 'block';
            carouselCounter.innerText = `1 / ${poi.imgUrls.length}`;
            poiCarousel.onscroll = () => {
              if (poi.imgUrls) {
                const index = Math.round(poiCarousel.scrollLeft / poiCarousel.clientWidth);
                carouselCounter.innerText = `${index + 1} / ${poi.imgUrls.length}`;
              }
            };
          }

          carouselPrev.onclick = (e) => {
            e.stopPropagation();
            if (poiCarousel) poiCarousel.scrollBy({ left: -poiCarousel.clientWidth, behavior: 'smooth' });
          };
          carouselNext.onclick = (e) => {
            e.stopPropagation();
            if (poiCarousel) poiCarousel.scrollBy({ left: poiCarousel.clientWidth, behavior: 'smooth' });
          };
        }
      }
    } else {
      poiVid.style.display = 'none';
      poiImg.style.display = 'block';
      poiImg.src = poi.imgUrl || 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=300&q=80';
    }

    updateFavoriteButton(poi.id);
    btnToggleFavorite.onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(poi.id);
    };

    if (btnGoogleMaps) {
      btnGoogleMaps.onclick = (e) => {
        e.stopPropagation();
        window.open(`https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`, '_blank');
      };
    }

    if (isAdmin) {
      btnAction.innerText = 'Editar Punto';
      btnAction.style.display = 'block';
      btnAction.onclick = () => {
        closeBottomSheet();
        openAdminModal(poi);
      };
    } else {
      btnAction.innerText = 'Centrar en el Mapa';
      btnAction.style.display = 'block';
      btnAction.onclick = () => {
        map.setView([poi.lat, poi.lng], 16, { animate: true });
        closeBottomSheet();
      };
    }

    bottomSheet.classList.add('open');
    map.setView([poi.lat, poi.lng], map.getZoom() > 13 ? map.getZoom() : 14);

    // Calcular y mostrar distancia desde A Miudiña
  const miudina = pois.find(p => p.id === 'poi-amiudina');
    if (miudina && poi.id !== miudina.id) {
      const dist = getDistance(miudina.lat, miudina.lng, poi.lat, poi.lng);
      if (poiDistance) {
        poiDistance.innerText = `A ${dist.toFixed(2)} km de A Miudiña`;
        poiDistance.style.display = 'block';
      }
    } else {
      if (poiDistance) poiDistance.style.display = 'none';
    }

    if (isRouteMode && poi.id !== 'poi-amiudina') {
      btnAction.innerText = customRoutePoints.find(p => p.id === poi.id) ? 'Quitar de la Ruta' : 'Añadir a mi Ruta';
      btnAction.onclick = () => {
        togglePointInRoute(poi);
        openBottomSheet(poi); // Refrescar botones
      };
    }
  };

  const adminModal = document.getElementById('admin-modal') as HTMLElement;
  const btnDeletePoi = document.getElementById('btn-delete-poi') as HTMLButtonElement;
  const btnCancelModal = document.getElementById('btn-cancel-modal') as HTMLButtonElement;

  const openAdminModal = (poi: POI) => {
    (document.getElementById('poi-id') as HTMLInputElement).value = poi.id || '';
    (document.getElementById('poi-lat') as HTMLInputElement).value = poi.lat.toString();
    (document.getElementById('poi-lng') as HTMLInputElement).value = poi.lng.toString();
    (document.getElementById('poi-input-name') as HTMLInputElement).value = poi.name || '';
    (document.getElementById('poi-input-desc') as HTMLTextAreaElement).value = poi.description || '';
    (document.getElementById('poi-input-cat') as HTMLSelectElement).value = poi.category || 'generico';
    (document.getElementById('poi-input-img') as HTMLInputElement).value = poi.imgUrl || '';
    (document.getElementById('poi-input-vid') as HTMLInputElement).value = poi.vidUrl || '';

    if (poi.id) {
      btnDeletePoi.style.display = 'block';
    } else {
      btnDeletePoi.style.display = 'none';
    }

    adminModal.classList.remove('hidden');
  };

  btnCancelModal?.addEventListener('click', () => {
    adminModal.classList.add('hidden');
  });

  btnDeletePoi?.addEventListener('click', () => {
    const id = (document.getElementById('poi-id') as HTMLInputElement).value;
    if (id && confirm('¿Seguro que quieres eliminar este punto?')) {
      pois = pois.filter(p => p.id !== id);
      savePOIs();
      renderMarkers();
      adminModal.classList.add('hidden');
      closeBottomSheet();
    }
  });

  const poiForm = document.getElementById('poi-form') as HTMLFormElement;
  poiForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = (document.getElementById('poi-id') as HTMLInputElement).value;
    const lat = parseFloat((document.getElementById('poi-lat') as HTMLInputElement).value);
    const lng = parseFloat((document.getElementById('poi-lng') as HTMLInputElement).value);
    const name = (document.getElementById('poi-input-name') as HTMLInputElement).value;
    const description = (document.getElementById('poi-input-desc') as HTMLTextAreaElement).value;
    const category = (document.getElementById('poi-input-cat') as HTMLSelectElement).value as POICategory;
    const imgUrl = (document.getElementById('poi-input-img') as HTMLInputElement).value;
    const vidUrl = (document.getElementById('poi-input-vid') as HTMLInputElement).value;

    if (id) {
      const idx = pois.findIndex(p => p.id === id);
      if (idx > -1) {
        pois[idx] = { ...pois[idx], lat, lng, name, description, category, imgUrl, vidUrl };
      }
    } else {
      const newPoi: POI = {
        id: 'custom-' + Date.now(),
        lat, lng, name, description, category, imgUrl, vidUrl
      };
      pois.push(newPoi);
    }

    savePOIs();
    renderMarkers();
    adminModal.classList.add('hidden');
  });

  const navExplorar = document.getElementById('nav-explorar') as HTMLElement;
  const navEventos = document.getElementById('nav-eventos') as HTMLElement;
  const navFavoritos = document.getElementById('nav-favoritos') as HTMLElement;
  const navMareas = document.getElementById('nav-mareas') as HTMLElement;
  const navMiRuta = document.getElementById('nav-mi-ruta') as HTMLElement;

  const setActiveNav = (elem: HTMLElement) => {
    [navExplorar, navEventos, navFavoritos, navMareas, navMiRuta].forEach(e => e?.classList.remove('active'));
    elem?.classList.add('active');

    if (elem !== navMiRuta && isRouteMode) {
      isRouteMode = false;
      if (routeOverlay) routeOverlay.classList.add('hidden');
      updateRoutePolyline();
    }
  };

  navExplorar.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navExplorar);
  });

  navEventos?.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navEventos);
    openEventsModal();
  });

  navFavoritos.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navFavoritos);
    openPlanesModal();
  });

  // Admin toggle removed: admin mode is permanently disabled
  navMareas?.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(navMareas);

    // Abrir modal en la pestaña de Mareas
    weatherDetailsModal.classList.remove('hidden');
    const tidesTabBtn = document.querySelector('.tab-btn[data-tab="mareas"]') as HTMLElement;
    tidesTabBtn?.dispatchEvent(new Event('click'));
  });


  const btnCloseRoute = document.getElementById('btn-close-route') as HTMLButtonElement;
  btnCloseRoute?.addEventListener('click', () => {
    isRouteMode = false;
    routeOverlay.classList.add('hidden');
    setActiveNav(navExplorar);
    updateRoutePolyline();
  });

  navMiRuta?.addEventListener('click', (e) => {
    e.preventDefault();
    isRouteMode = true; // Siempre forzamos el modo ruta (el usuario puede salir con la X ahora)
    setActiveNav(navMiRuta);
    closeBottomSheet();
    // Cargar ruta guardada o empezar desde A Miudiña si es nueva
    if (customRoutePoints.length === 0) {
      const savedRoute = localStorage.getItem(ROUTE_STORAGE_KEY);
      if (savedRoute) {
        try {
          const savedIds: string[] = JSON.parse(savedRoute);
          const loaded = savedIds.map(id => pois.find(p => p.id === id)).filter(Boolean) as POI[];
          if (loaded.length > 0) customRoutePoints = loaded;
        } catch (_) {}
      }
      if (customRoutePoints.length === 0) {
        const miudina = pois.find(p => p.id === 'poi-amiudina');
        if (miudina) customRoutePoints.push(miudina);
      }
    }
    
    // Mostramos la interfaz de ruta y luego SIEMPRE abrimos el menú modal de rutas
    updateRoutePolyline();
    openRoutesListModal();
  });

  btnClearRoute?.addEventListener('click', () => {
    customRoutePoints = [];
    const miudina = pois.find(p => p.id === 'poi-amiudina');
    if (miudina) customRoutePoints.push(miudina);
    updateRoutePolyline();
    closeBottomSheet();
  });

  btnSaveRouteUI?.addEventListener('click', () => {
    if (customRoutePoints.length > 1) {
      const name = prompt('Nombre para esta ruta:', `Ruta ${new Date().toLocaleDateString()}`);
      if (name) {
        savedRoutes.unshift({ name, pois: customRoutePoints.map(p => p.id) });
        localStorage.setItem(MULTI_ROUTES_KEY, JSON.stringify(savedRoutes));
        alert('Ruta guardada con éxito.');
      }
    }
  });

  btnListRoutes?.addEventListener('click', () => {
    openRoutesListModal();
  });

  const routesListModal = document.getElementById('routes-list-modal') as HTMLElement;
  const btnCloseRoutesList = document.getElementById('btn-close-routes-list') as HTMLElement;
  const savedRoutesContainer = document.getElementById('saved-routes-container') as HTMLElement;

  const openRoutesListModal = () => {
    if (!savedRoutesContainer) return;
    savedRoutesContainer.innerHTML = '';
    
    if (savedRoutes.length === 0) {
      savedRoutesContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary); font-weight: 700; padding:20px;">No tienes rutas guardadas aún.</p>';
    }

    savedRoutes.forEach((route, index) => {
      const card = document.createElement('div');
      card.className = 'event-card'; 
      card.style.marginBottom = '12px';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="name" style="color:var(--text-primary); font-size:16px; font-weight:800; display:block;">${route.name}</span>
            <span class="desc" style="font-size:12px; color:var(--text-secondary); font-weight:600;">${route.pois.length} paradas</span>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="load-btn" style="background:var(--primary); color:white; border:none; padding:10px 16px; border-radius:14px; font-size:13px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(37,99,235,0.4); display:flex; align-items:center; gap:6px; transition:transform 0.2s;">
              <span>📍</span> Cargar
            </button>
            <button class="delete-btn" style="background:rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2); padding:10px 14px; border-radius:14px; font-size:14px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center;">
              🗑️
            </button>
          </div>
        </div>
      `;

      card.querySelector('.load-btn')?.addEventListener('click', () => {
        const loadedPois = route.pois.map(id => pois.find(p => p.id === id)).filter(Boolean) as POI[];
        if (loadedPois.length > 0) {
          customRoutePoints = loadedPois;
          const routeCurrentName = document.getElementById('route-current-name');
          if (routeCurrentName) routeCurrentName.innerText = route.name;
          updateRoutePolyline();
          routesListModal.classList.add('hidden');
        }
      });

      card.querySelector('.delete-btn')?.addEventListener('click', () => {
        if (confirm('¿Eliminar esta ruta?')) {
          savedRoutes.splice(index, 1);
          localStorage.setItem(MULTI_ROUTES_KEY, JSON.stringify(savedRoutes));
          openRoutesListModal();
        }
      });

      savedRoutesContainer.appendChild(card);
    });

    routesListModal.classList.remove('hidden');
  };

  btnCloseRoutesList?.addEventListener('click', () => routesListModal.classList.add('hidden'));

  const planesModal = document.getElementById('planes-modal') as HTMLElement;
  const btnClosePlanes = document.getElementById('btn-close-planes') as HTMLElement;
  const favoritesListContainer = document.getElementById('favorites-list') as HTMLElement;
  const rainyPlansContainer = document.getElementById('rainy-plans-list') as HTMLElement;

  const openPlanesModal = () => {
    renderFavorites();
    renderRainyPlans();
    planesModal.classList.remove('hidden');
    
    // Reset tabs to recommended by default
    const firstTab = document.querySelector('.plane-tab-btn[data-plane-tab="recomendados"]') as HTMLElement;
    firstTab?.click();

    // Reset view to list
    const detailView = document.getElementById('plan-detail-view');
    if (rainyPlansContainer) rainyPlansContainer.classList.remove('hidden');
    if (detailView) detailView.classList.add('hidden');
  };

  const renderFavorites = () => {
    if (!favoritesListContainer) return;
    favoritesListContainer.innerHTML = '';

    const favPois = favorites.map(id => pois.find(p => p.id === id)).filter(Boolean) as POI[];

    if (favPois.length === 0) {
      favoritesListContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary); font-weight: 700; padding:40px; opacity: 0.6;">No tienes favoritos guardados aún.</p>';
      return;
    }

    favPois.forEach(poi => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.style.marginBottom = '12px';
      card.innerHTML = `
        <div style="display:flex; gap:12px; align-items:center; padding: 12px;">
          <img src="${poi.imgUrl || (poi.imgUrls ? poi.imgUrls[0] : 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=100&q=80')}" style="width:55px; height:55px; border-radius:12px; object-fit:cover;" />
          <div style="flex:1;">
            <span class="name" style="color:var(--text-primary); font-size:16px; font-weight:800; display:block;">${poi.name}</span>
            <span class="desc" style="font-size:12px; color:var(--text-secondary); font-weight:600;">${poi.category}</span>
          </div>
          <button class="btn-clear view-btn" style="background:var(--primary); color:white; padding:8px 16px; font-size:12px; font-weight:800; border-radius:12px;">Ver</button>
        </div>
      `;

      card.querySelector('.view-btn')?.addEventListener('click', () => {
        map.setView([poi.lat, poi.lng], 16, { animate: true });
        openBottomSheet(poi);
        planesModal.classList.add('hidden');
      });

      favoritesListContainer.appendChild(card);
    });
  };

  const renderRainyPlans = () => {
    if (!rainyPlansContainer) return;
    rainyPlansContainer.innerHTML = '';

    RAINY_PLANS.forEach(plan => {
      const card = document.createElement('div');
      card.className = 'rainy-plan-card';
      card.innerHTML = `
        <div class="plan-header" style="margin-bottom: 0;">
          <div class="plan-title">${plan.emoji} ${plan.title}</div>
          <div class="plan-duration">${plan.duration}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        showPlanDetail(plan);
      });
      
      rainyPlansContainer.appendChild(card);
    });
  };

  const showPlanDetail = (plan: typeof RAINY_PLANS[0]) => {
    const detailView = document.getElementById('plan-detail-view');
    const detailContent = document.getElementById('plan-detail-content');
    const startBtn = document.getElementById('btn-start-plan');

    if (!rainyPlansContainer || !detailView || !detailContent || !startBtn) return;

    detailContent.innerHTML = `
      <div class="plan-detail-header">
        <div class="plan-detail-emoji">${plan.emoji}</div>
        <div class="plan-detail-title-group">
          <div class="plan-duration" style="margin-bottom: 5px; display: inline-block;">${plan.duration}</div>
          <h2>${plan.title}</h2>
        </div>
      </div>
      
      <div class="plan-detail-summary">
        <p>${plan.description}</p>
      </div>

      <div class="plan-detail-section-title">¿Qué esperar de este plan?</div>
      <ul class="plan-detail-items">
        ${plan.items.map(item => `<li><span>📍</span> ${item}</li>`).join('')}
      </ul>

      <div class="plan-detail-hint">
        <span>✨</span>
        <div>
          <strong style="display:block; margin-bottom: 2px;">Consejo Belusín:</strong>
          ${plan.hint}
        </div>
      </div>
    `;

    rainyPlansContainer.classList.add('hidden');
    detailView.classList.remove('hidden');

    startBtn.onclick = () => {
      loadPlanAsRoute(plan);
    };
  };

  const btnBackToPlans = document.getElementById('btn-back-to-plans');
  btnBackToPlans?.addEventListener('click', () => {
    const detailView = document.getElementById('plan-detail-view');
    if (rainyPlansContainer) rainyPlansContainer.classList.remove('hidden');
    if (detailView) detailView.classList.add('hidden');
  });

  // Lógica de pestañas para el modal de planes
  const planeTabBtns = document.querySelectorAll('.plane-tab-btn');
  const planeTabContents = document.querySelectorAll('.plane-tab-content');

  planeTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.planeTab;
      planeTabBtns.forEach(b => b.classList.remove('active'));
      planeTabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetContent = document.getElementById(`tab-${tab}`);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  btnClosePlanes?.addEventListener('click', () => {
    planesModal.classList.add('hidden');
    setActiveNav(navExplorar);
  });

  btnShareRoute?.addEventListener('click', async () => {
    if (customRoutePoints.length > 1) {
      const routeNames = customRoutePoints.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      const distText = routeTotalDist?.innerText || '';
      const shareText = `🗺️ Mi Ruta en Beluso (${distText}):\n\n${routeNames}\n\n📱 AppBeluso - Tu guía de turismo`;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Mi Ruta en Beluso', text: shareText });
        } catch (_) {}
      } else {
        try {
          await navigator.clipboard.writeText(shareText);
          const originalText = btnShareRoute.innerText;
          btnShareRoute.innerText = '✅ Copiado';
          setTimeout(() => { btnShareRoute.innerText = originalText; }, 2000);
        } catch (_) {
          alert(shareText);
        }
      }
    }
  });

  const togglePointInRoute = (poi: POI) => {
    const index = customRoutePoints.findIndex(p => p.id === poi.id);
    if (index > -1) {
      customRoutePoints.splice(index, 1);
    } else {
      customRoutePoints.push(poi);
    }
    updateRoutePolyline();
  };

  const loadPlanAsRoute = (plan: typeof RAINY_PLANS[0]) => {
    isRouteMode = true;
    setActiveNav(navMiRuta);
    
    // Convertir routeCoords a formato POI
    customRoutePoints = plan.routeCoords.map(coord => ({
      id: `plan-point-${Date.now()}-${Math.random()}`,
      lat: coord.lat,
      lng: coord.lng,
      name: coord.name,
      description: plan.title,
      category: 'generico'
    }));

    // Actualizar nombre de la ruta en la UI
    const routeCurrentName = document.getElementById('route-current-name');
    if (routeCurrentName) routeCurrentName.innerText = plan.title;

    updateRoutePolyline();
    planesModal.classList.add('hidden');
    
    // Centrar mapa en el primer punto
    if (customRoutePoints.length > 0) {
      map.setView([customRoutePoints[0].lat, customRoutePoints[0].lng], 13, { animate: true });
    }
  };

  const updateRoutePolyline = async () => {
    if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
    if (routeOutlinePolyline) { map.removeLayer(routeOutlinePolyline); routeOutlinePolyline = null; }

    if (isRouteMode && customRoutePoints.length > 1) {
      try {
        // Usar OSRM para rutas reales por caminos
        const coords = customRoutePoints.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.routes || data.routes.length === 0) throw new Error('Sin ruta');

        const totalDist = data.routes[0].distance / 1000;
        const routeCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);

        // Contorno para mejor visibilidad
        routeOutlinePolyline = L.polyline(routeCoords, {
          color: '#FFFFFF',
          weight: 12,
          opacity: 0.7,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);

        // Ruta principal en naranja brillante muy visible
        routePolyline = L.polyline(routeCoords, {
          color: '#FF5722',
          weight: 7,
          opacity: 1,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);

        if (routeOverlay && routeTotalDist) {
          routeOverlay.classList.remove('hidden');
          routeTotalDist.innerText = `${totalDist.toFixed(2)} km`;
        }
      } catch (err) {
        console.warn('Fallo OSRM, usando línea recta:', err);
        const latlngs = customRoutePoints.map(p => [p.lat, p.lng] as L.LatLngTuple);
        routeOutlinePolyline = L.polyline(latlngs, { color: '#FFFFFF', weight: 11, opacity: 0.5 }).addTo(map);
        routePolyline = L.polyline(latlngs, { color: '#FF5722', weight: 6, opacity: 0.95 }).addTo(map);

        const totalDist = customRoutePoints.reduce((acc, curr, i) => {
          if (i === 0) return 0;
          return acc + getDistance(customRoutePoints[i - 1].lat, customRoutePoints[i - 1].lng, curr.lat, curr.lng);
        }, 0);
        if (routeOverlay && routeTotalDist) {
          routeOverlay.classList.remove('hidden');
          routeTotalDist.innerText = `${totalDist.toFixed(2)} km`;
        }
      }
    } else {
      if (routeOverlay) routeOverlay.classList.add('hidden');
    }
  };

  // --- Lógica de Eventos ---
  const eventsModal = document.getElementById('events-modal') as HTMLElement;
  const eventsList = document.getElementById('events-list') as HTMLElement;
  const btnCloseEvents = document.getElementById('btn-close-events') as HTMLElement;

  const openEventsModal = () => {
    if (!eventsList) return;
    eventsList.innerHTML = '';
    
    const now = new Date().getTime();
    const upcomingEvents = EVENTS_DATA.filter(ev => {
      // Filtrar eventos que no tengan fecha o cuya fecha (timestamp) sea mayor o igual que hoy
      return !ev.timestamp || ev.timestamp >= now;
    });

    if (upcomingEvents.length === 0) {
      eventsList.innerHTML = '<p style="text-align:center; color: var(--text-secondary); font-weight: 700; padding:20px;">No hay próximos eventos programados.</p>';
    }

    upcomingEvents.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <span class="date">${ev.date}</span>
        <span class="name">${ev.name}</span>
        <span class="desc">${ev.description}</span>
        <small class="hint"><span>📍</span> Ver en Mapa</small>
      `;
      card.onclick = () => {
        map.setView([ev.lat, ev.lng], 16, { animate: true });
        eventsModal.classList.add('hidden');
        setActiveNav(navExplorar);
      };
      eventsList.appendChild(card);
    });
    eventsModal.classList.remove('hidden');
  };

  btnCloseEvents?.addEventListener('click', () => {
    eventsModal.classList.add('hidden');
    setActiveNav(navExplorar);
  });

  // Admin controls removed: admin UI disabled
  // --- 5. API de Clima Real y Personaje Interactivo ---
  const weatherWidget = document.getElementById('weather-widget') as HTMLElement;
  const rainContainer = document.getElementById('rain') as HTMLElement;
  const weatherDesc = document.getElementById('weather-desc') as HTMLElement;
  const tempVal = document.getElementById('temp-val') as HTMLElement;

  type WeatherState = 'sunny' | 'cloudy' | 'rain' | 'thunder';
  let currentWeather: WeatherState = 'rain'; // Estado base guiado por la API
  let weatherInterval: number | null = null;
  let extremeTimeout: number | null = null;
  const createParticle = (type: 'rain' | 'vomit' | 'wind' | 'thunder' | 'heart' | 'sparkle' | 'sun' | 'cloud') => {
    if (!rainContainer) return;
    const particle = document.createElement('div');
    const left = Math.random() * 50;

    const floatingTypes = ['heart', 'sparkle', 'sun', 'cloud'];
    if (floatingTypes.includes(type)) {
      particle.className = `heart-particle ${type}`;
      let emoji = '❤️';
      if (type === 'sparkle') emoji = '✨';
      else if (type === 'sun') emoji = '☀️';
      else if (type === 'cloud') emoji = '☁️';
      
      particle.innerText = emoji;
      particle.style.left = `${left}px`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 1000);
      return;
    }

    if (type === 'rain' || type === 'vomit') {
      const cls = type === 'vomit' ? 'vomit-drop' : 'raindrop';
      particle.classList.add(cls);
      const duration = type === 'vomit' ? 0.2 + Math.random() * 0.2 : 0.5 + Math.random() * 0.3;
      particle.style.left = `${left}px`;
      particle.style.animationDuration = `${duration}s`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), duration * 1000);
    } else if (type === 'wind') {
      particle.classList.add('wind-line');
      particle.style.top = `${10 + Math.random() * 20}px`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 500);
    } else if (type === 'thunder') {
      particle.classList.add('thunder-bolt');
      particle.style.left = `${20 + Math.random() * 20}px`;
      rainContainer.appendChild(particle);
      setTimeout(() => particle.remove(), 300);
    }
  };

  const startNormalWeather = () => {
    if (weatherInterval) clearInterval(weatherInterval);
    if (currentWeather === 'rain' || currentWeather === 'thunder') {
      weatherInterval = setInterval(() => createParticle('rain'), 80);
    }
  };

  const applyWeatherState = (state: WeatherState, desc: string, temp: number | string) => {
    currentWeather = state;
    tempVal.innerText = temp.toString();
    weatherDesc.innerText = desc;

    // Limpieza de clases
    weatherWidget.classList.remove('sunny', 'cloudy', 'rain', 'thunder', 'extreme');
    weatherWidget.classList.add(state);

    // Actualizar fondo animado - REMOVED per user request
    document.querySelectorAll('.weather-bg-state').forEach(el => el.classList.remove('active'));

    // Actualizar tema global (para variables de contraste)
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.classList.remove('bg-sunny', 'bg-cloudy', 'bg-rain');
      appContainer.classList.add(`bg-${state === 'thunder' ? 'rain' : state}`);
    }

    // Actualizar fondo del widget de clima
    if (weatherWidget) {
      weatherWidget.classList.remove('bg-sunny', 'bg-cloudy', 'bg-rain');
      weatherWidget.classList.add(`bg-${state === 'thunder' ? 'rain' : state}`);
    }

    // Actualizar tema del modal de clima
    const weatherModalContent = document.querySelector('.weather-modal-content');
    if (weatherModalContent) {
      weatherModalContent.classList.remove('bg-sunny', 'bg-cloudy', 'bg-rain');
      weatherModalContent.classList.add(`bg-${state === 'thunder' ? 'rain' : state}`);
    }

    startNormalWeather();
  };


  let weatherFetchInterval: number | null = null;
  const fetchRealWeather = async () => {
    try {
      console.log("Obteniendo clima de Met Norway...");
      const lat = 42.332, lon = -8.814;
      const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;

      const res = await fetch(url, { headers: { 'User-Agent': 'AppBeluso/1.0 (contact@beluso.app)' } });
      if (!res.ok) throw new Error("Estado Met: " + res.status);

      const data = await res.json();
      const current = data.properties.timeseries[0];
      const temp = current.data.instant.details.air_temperature;
      const symbol = current.data.next_1_hours?.summary.symbol_code || current.data.next_6_hours?.summary.symbol_code || "fair_day";

      console.log("Clima:", symbol, temp);

      let state: WeatherState = 'sunny';
      let desc = 'Despejado';

      if (symbol.includes('sun') || symbol.includes('clear')) {
        state = 'sunny'; desc = 'Despejado';
      } else if (symbol.includes('rain')) {
        state = 'rain'; desc = 'Lluvia';
      } else if (symbol.includes('thunder')) {
        state = 'thunder'; desc = 'Tormenta';
      } else if (symbol.includes('cloud') || symbol.includes('fair') || symbol.includes('fog')) {
        state = 'cloudy'; desc = 'Nublado';
      }

      applyWeatherState(state, desc, Math.round(temp));
      
      // Actualizar info en el botón de navegación de Mareas (Solo marea, no clima por petición de usuario)
      /* const navInfo = document.getElementById('nav-mareas-info');
      if (navInfo) {
        navInfo.innerText = `${Math.round(temp)}°C | ${desc}`;
      } */


      const mTemp = document.getElementById('modal-temp');
      const mDesc = document.getElementById('modal-desc');
      const mIcon = document.getElementById('modal-icon-emoji');
      if (mTemp) mTemp.innerText = `${Math.round(temp)}°`;
      if (mDesc) mDesc.innerText = desc;
      if (mIcon) {
        let icon = '☀️';
        if (state === 'rain') icon = '🌧️';
        else if (state === 'thunder') icon = '⛈️';
        else if (state === 'cloudy') icon = '🌥️';
        mIcon.innerText = icon;
      }

      const vientoEl = document.getElementById('val-viento');
      const humedadEl = document.getElementById('val-humedad');
      const uvEl = document.getElementById('val-uv');
      if (vientoEl) vientoEl.innerText = `${Math.round(current.data.instant.details.wind_speed * 3.6)} km/h`;
      if (humedadEl) humedadEl.innerText = `${Math.round(current.data.instant.details.relative_humidity)}%`;
      if (uvEl) {
        const uvIndex = current.data.instant.details.ultraviolet_index_clear_sky;
        uvEl.innerText = uvIndex !== undefined ? (uvIndex < 3 ? "Bajo" : uvIndex < 6 ? "Medio" : "Alto") : "Medio";
      }

      const hourlyList = document.getElementById('hourly-list');
      if (hourlyList) {
        let hHtml = '';
        for (let i = 0; i < 12; i++) {
          const hEntry = data.properties.timeseries[i];
          if (!hEntry) continue;
          const hTime = new Date(hEntry.time);
          const hTemp = Math.round(hEntry.data.instant.details.air_temperature);
          const hSym = hEntry.data.next_1_hours?.summary.symbol_code || "fair_day";
          let hIcon = '☀️';
          if (hSym.includes('rain')) hIcon = '🌧️';
          else if (hSym.includes('cloud')) hIcon = '🌥️';

          hHtml += `
            <div class="hourly-item ${i === 0 ? 'active' : ''}">
              <span class="time">${hTime.getHours()}:00</span>
              <span style="font-size:20px;">${hIcon}</span>
              <span class="temp">${hTemp}°</span>
            </div>
          `;
        }
        hourlyList.innerHTML = hHtml;
      }

      const dailyList = document.getElementById('daily-list');
      if (dailyList) {
        // Build a map of date -> first timeseries entry for that day, to avoid skipping days
        const ts = data.properties.timeseries || [];
        const byDate: { [key: string]: any } = {};
        ts.forEach((entry: any) => {
          const d = new Date(entry.time);
          const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
          if (!byDate[key]) {
            byDate[key] = entry;
          }
        });
        // Collect and sort by date ascending
        const days = Object.keys(byDate).sort().slice(0, 5);
        let dHtml = '';
        days.forEach((dateKey) => {
          const entry = byDate[dateKey];
          if (!entry) return;
          const dDate = new Date(entry.time);
          const dTemp = Math.round(entry.data.instant.details.air_temperature);
          const dSym = entry.data.next_6_hours?.summary.symbol_code || "fair_day";
          const dayName = dDate.toLocaleDateString('es-ES', { weekday: 'short' });
          let dIcon = '☀️';
          if (dSym.includes('rain')) dIcon = '🌧️';
          else if (dSym.includes('cloud')) dIcon = '🌥️';
          dHtml += `
            <div class="daily-item">
              <span class="day">${dayName}</span>
              <span style="font-size:24px;">${dIcon}</span>
              <span class="temp">${dTemp}°</span>
            </div>
          `;
        });
        dailyList.innerHTML = dHtml;
      }

      const updatedEl = document.getElementById('weather-updated');
      if (updatedEl) {
        const now = new Date();
        updatedEl.innerText = `Actualizado: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      }
    } catch (e) {
      console.error("Fallo al actualizar el clima:", e);
      applyWeatherState('cloudy', 'Error de conexión', '--');
    }
  };


  // --- 8. Lógica Climática Avanzada ---
  const setupDragScroll = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    el.addEventListener('mousedown', (e) => {
      isDown = true;
      el.classList.add('active');
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('mouseleave', () => {
      isDown = false;
      el.style.cursor = 'grab';
    });
    el.addEventListener('mouseup', () => {
      isDown = false;
      el.style.cursor = 'grab';
    });
    el.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 2;
      el.scrollLeft = scrollLeft - walk;
    });
  };

  setupDragScroll('hourly-list');
  setupDragScroll('daily-list');

  const weatherDetailsModal = document.getElementById('weather-details-modal') as HTMLElement;
  const btnCloseWeather = document.getElementById('btn-close-weather') as HTMLElement;

  const closeWeatherModal = () => weatherDetailsModal.classList.add('hidden');
  if (btnCloseWeather) btnCloseWeather.onclick = closeWeatherModal;

  // Cerrar modal al tocar el backdrop (fondo oscuro)
  const closeOnBackdrop = (modal: HTMLElement, closeFn: () => void) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeFn();
      }
    });
  };

  closeOnBackdrop(weatherDetailsModal, closeWeatherModal);
  closeOnBackdrop(eventsModal, () => eventsModal.classList.add('hidden'));
  closeOnBackdrop(routesListModal, () => routesListModal.classList.add('hidden'));
  closeOnBackdrop(planesModal, () => planesModal.classList.add('hidden'));

  // --- 9. Lógica de Interacción con el Espíritu del Tiempo ---
  let moodClicks = 0;
  let moodTimeout: number | null = null;
  let resetMoodTimeout: number | null = null;

  const triggerMood = (mood: 'laugh' | 'angry' | 'annoyed' | 'fury') => {
    weatherWidget.classList.remove('mood-laugh', 'mood-angry', 'mood-annoyed', 'mood-fury');
    void (weatherWidget as any).offsetWidth;
    weatherWidget.classList.add(`mood-${mood}`);

    if (resetMoodTimeout) clearTimeout(resetMoodTimeout);
    resetMoodTimeout = window.setTimeout(() => {
      weatherWidget.classList.remove('mood-laugh', 'mood-angry', 'mood-annoyed', 'mood-fury');
      moodClicks = 0;
    }, mood === 'fury' ? 5000 : 3000);
  };

  const mascotContainer = document.getElementById('mascot');

  weatherWidget.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!weatherDetailsModal.classList.contains('hidden')) return;

    // Detectar si se clickea el personaje
    const isMascotClick = mascotContainer && (e.target === mascotContainer || mascotContainer.contains(e.target as Node));
    // Detectar si se clickea la información
    const infoContainer = document.querySelector('.weather-info');
    const isInfoClick = infoContainer && (e.target === infoContainer || infoContainer.contains(e.target as Node));

    if (isMascotClick) {
      moodClicks++;
      if (moodTimeout) clearTimeout(moodTimeout);
      moodTimeout = window.setTimeout(() => {
        if (moodClicks >= 4) triggerMood('fury');
        else if (moodClicks === 3) triggerMood('angry');
        else if (moodClicks === 2) triggerMood('annoyed');
        else triggerMood('laugh');
      }, 250);
    } else if (isInfoClick) {
      weatherDetailsModal.classList.remove('hidden');
    }
  });

  // Lógica de cambio de pestañas
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
  });

  // Cerrar bottom sheet al tocar en el mapa o añadir punto si es admin
  map.on('click', (e) => {
    if (isAdmin) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      openAdminModal({
        id: '',
        lat,
        lng,
        name: '',
        description: '',
        category: 'generico'
      });
    } else {
      closeBottomSheet();
    }
  });

  const populateRealTides = async () => {
    const tidesList = document.getElementById('modal-tides-list');
    const tidePath = document.getElementById('tide-path');
    const marker = document.getElementById('tide-now-marker');
    if (!tidesList) return;

    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      const tToday = calculateTidesForDate(now);
      const todayHtml = `
        <div class="tide-card active">
          <div class="type">Hoy</div>
          <div class="time">P: ${tToday.high} | B: ${tToday.low}</div>
        </div>
      `;
      // Preparar simulación para el gráfico
      const todayHourly: number[] = [];
      const epoch = new Date('2024-04-01T03:00:00').getTime();
      const tideCycle = 12.42;
      for (let h = 0; h < 24; h++) {
        const d = new Date(now); d.setHours(h, 0, 0, 0);
        const diffHours = (d.getTime() - epoch) / (1000 * 60 * 60);
        todayHourly.push(2 + 1.5 * Math.sin((diffHours / tideCycle) * 2 * Math.PI));
      }

      const peaks: { hour: number, val: number, isHigh: boolean }[] = [];
      for (let h = 1; h < 23; h++) {
        if (todayHourly[h] > todayHourly[h - 1] && todayHourly[h] > todayHourly[h + 1]) peaks.push({ hour: h, val: todayHourly[h], isHigh: true });
        if (todayHourly[h] < todayHourly[h - 1] && todayHourly[h] < todayHourly[h + 1]) peaks.push({ hour: h, val: todayHourly[h], isHigh: false });
      }

      const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);

      const nextDays = [
        { day: 'Mañana', date: tomorrow },
        { day: 'Pasado', date: dayAfter }
      ];

      const nextDaysHtml = nextDays.map(d => {
        const t = calculateTidesForDate(d.date);
        return `
          <div class="tide-card">
            <div class="type">${d.day}</div>
            <div class="time">P: ${t.high} | B: ${t.low}</div>
          </div>
        `;
      }).join('');

      tidesList.innerHTML = todayHtml + nextDaysHtml;

      // Dibujo del gráfico
      const labelLayer = document.getElementById('tide-labels-layer');
      if (tidePath && labelLayer) {
        labelLayer.innerHTML = ''; // Limpiar etiquetas antiguas
        const values = todayHourly;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = (max - min) || 1;

        let pathData = "M 0 50";
        const points: { x: number, y: number, v: number, h: number }[] = [];

        values.forEach((v: number, i: number) => {
          const x = (i / 23) * 100;
          const y = 50 - ((v - min) / range) * 35 - 8; // Ajustar para que quepa en el viewbox 0-50
          pathData += ` L ${x} ${y}`;
          points.push({ x, y, v, h: i });

          // Dibujar marcadores de tiempo (0, 6, 12, 18, 23)
          if (i % 6 === 0 || i === 23) {
            const timeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            timeText.setAttribute("x", x.toString());
            timeText.setAttribute("y", "58");
            timeText.setAttribute("text-anchor", "middle");
            timeText.setAttribute("font-size", "3.5");
            timeText.textContent = `${i}:00`;
            labelLayer.appendChild(timeText);

            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute("x1", x.toString()); vLine.setAttribute("y1", "48");
            vLine.setAttribute("x2", x.toString()); vLine.setAttribute("y2", "50");
            vLine.setAttribute("stroke", "var(--glass-border)"); vLine.setAttribute("stroke-width", "0.3");
            labelLayer.appendChild(vLine);
          }
        });
        pathData += " L 100 50 Z";
        tidePath.setAttribute('d', pathData);

        // Resaltar Picos en el gráfico
        peaks.forEach(p => {
          const pt = points[p.hour];
          if (pt) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", pt.x.toString());
            circle.setAttribute("cy", pt.y.toString());
            circle.setAttribute("r", "1.5");
            circle.setAttribute("fill", p.isHigh ? "#2563eb" : "#d97706");
            circle.setAttribute("stroke", "white");
            circle.setAttribute("stroke-width", "0.5");
            labelLayer.appendChild(circle);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", pt.x.toString());
            text.setAttribute("y", (pt.y - (p.isHigh ? 4 : -7)).toString());
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("font-size", "3");
            text.setAttribute("fill", "var(--text-primary)");
            text.textContent = `${p.val.toFixed(2)}m`;
            labelLayer.appendChild(text);
          }
        });

        if (marker) {
          const nowTime = new Date();
          const currentProgress = (nowTime.getHours() * 60 + nowTime.getMinutes()) / (24 * 60);
          const xNow = currentProgress * 100;
          marker.setAttribute('x1', xNow.toString());
          marker.setAttribute('x2', xNow.toString());
          marker.style.display = 'block';
        }
      }

    } catch (e) {
      console.error("Mareas Error Final:", e);
      tidesList.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 20px;">
          <p style="font-size:12px; color:var(--danger); margin-bottom:10px;">No se pudo conectar con el servicio de mareas.</p>
          <button onclick="window.location.reload()" class="btn-primary" style="padding:8px 16px; border-radius:20px; font-size:11px;">Reintentar</button>
        </div>
      `;
    }
  };
  const btnAdminToggle = document.getElementById('btn-admin-toggle');
  btnAdminToggle?.addEventListener('click', () => {
    isAdmin = !isAdmin;
    document.body.classList.toggle('admin-mode', isAdmin);
    btnAdminToggle.classList.toggle('active', isAdmin);
    renderMarkers();
    
    // Notificación visual rápida
    const msg = isAdmin ? 'Modo Administrador ACTIVADO. Ahora puedes arrastrar los puntos.' : 'Modo Administrador DESACTIVADO.';
    console.log(msg);
  });

  // loadPOIs(); // Deshabilitado para forzar que todos los dispositivos usen siempre DEFAULT_POIS
  renderMarkers();
  fetchRealWeather();
  populateRealTides();
  
  if (weatherFetchInterval) clearInterval(weatherFetchInterval);
  weatherFetchInterval = window.setInterval(() => {
    fetchRealWeather();
    populateRealTides();
  }, 60 * 60 * 1000);

  window.addEventListener('beforeunload', () => {
    if (weatherInterval) clearInterval(weatherInterval);
    if (weatherFetchInterval) clearInterval(weatherFetchInterval);
    if (extremeTimeout) clearTimeout(extremeTimeout);
  });
  // --- 10. Lógica de Música de Fondo ---
  const bgMusic = document.getElementById('bg-music') as HTMLAudioElement;
  const musicToggleBtn = document.getElementById('btn-music-toggle');
  let musicStarted = false;

  const startMusic = () => {
    if (musicStarted || !bgMusic) return;
    
    // Si el splash screen sigue activo, esperamos a que se oculte
    if (splashScreen && !splashScreen.classList.contains('hidden')) {
      return;
    }
    
    bgMusic.muted = false;
    bgMusic.volume = 0.1; 
    bgMusic.play().then(() => {
      musicStarted = true;
      musicToggleBtn?.classList.remove('muted');
    }).catch(err => {
      console.warn("Música bloqueada:", err);
      // Fallback: intentar al primer clic
      document.addEventListener('click', () => {
        if (!musicStarted) startMusic();
      }, { once: true });
    });
  };

  // Intentar empezar música inmediatamente (el navegador decidirá si permite el autoplay)
  startMusic();

  // Asegurar que la música arranque al terminar el splash automáticamente
  const originalHideSplash = hideSplash;
  // @ts-ignore
  hideSplash = () => {
    originalHideSplash();
    setTimeout(startMusic, 100);
  };

  musicToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!bgMusic) return;
    
    const icon = musicToggleBtn.querySelector('i');
    if (bgMusic.paused) {
      bgMusic.play();
      musicToggleBtn.classList.remove('muted');
      if (icon) {
        icon.classList.remove('fa-volume-xmark');
        icon.classList.add('fa-volume-high');
      }
    } else {
      bgMusic.pause();
      musicToggleBtn.classList.add('muted');
      if (icon) {
        icon.classList.remove('fa-volume-high');
        icon.classList.add('fa-volume-xmark');
      }
    }
  });

});
