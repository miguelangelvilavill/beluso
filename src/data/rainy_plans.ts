export interface RainyPlan {
  id: string;
  title: string;
  emoji: string;
  duration: string;
  description: string;
  items: string[];
  hint: string;
  routeCoords: { lat: number, lng: number, name: string }[];
}

export const RAINY_PLANS: RainyPlan[] = [
  {
    id: 'cultural',
    title: 'Plan Cultural',
    emoji: '🏛️',
    duration: 'Mañana tranquila',
    description: 'Ideal para empezar el día sumergiéndote en la historia local sin prisas.',
    items: [
      '10:30 – Visita al Museo Massó',
      '12:00 – Paseo corto por el puerto',
      '12:30 – Café aromático en el centro de Bueu'
    ],
    hint: 'Sumerge en la historia conservera de Galicia.',
    routeCoords: [
      { lat: 42.3320, lng: -8.8143, name: 'A Miudiña' },
      { lat: 42.3268, lng: -8.7852, name: 'Museo Massó' },
      { lat: 42.3275, lng: -8.7845, name: 'Puerto de Bueu' }
    ]
  },
  {
    id: 'gastronomico',
    title: 'Plan Gastronómico',
    emoji: '🍽️',
    duration: 'El clásico gallego',
    description: 'Un plan sencillo diseñado para disfrutar de la mejor cocina local y una sobremesa inolvidable.',
    items: [
      '13:30 – Comida en Bueu o Cangas',
      '15:00 – Sobremesa larga',
      '17:00 – Paseo corto por el casco histórico'
    ],
    hint: 'La mejor forma de "pasar" la tarde refugiado en buen ambiente.',
    routeCoords: [
      { lat: 42.3320, lng: -8.8143, name: 'A Miudiña' },
      { lat: 42.3265, lng: -8.7855, name: 'Centro de Bueu' },
      { lat: 42.2642, lng: -8.7843, name: 'Casco Viejo Cangas' }
    ]
  },
  {
    id: 'tranquilo',
    title: 'Plan Tranquilo',
    emoji: '☕',
    duration: 'Tarde relajada',
    description: 'Perfecto para desconectar por completo viendo caer la lluvia sobre el mar.',
    items: [
      '16:30 – Llegada al pintoresco Aldán',
      '17:00 – Café con vistas privilegiadas a la ría',
      '18:30 – Lectura, charla o contemplación'
    ],
    hint: 'Para cuando el cuerpo pide calma y paisaje.',
    routeCoords: [
      { lat: 42.3320, lng: -8.8143, name: 'A Miudiña' },
      { lat: 42.2785, lng: -8.8250, name: 'Marina de Aldán' }
    ]
  },
  {
    id: 'relax',
    title: 'Plan Relax',
    emoji: '🧖',
    duration: 'Spa + Desconexión',
    description: 'Una escapada especial para renovar energías mientras fuera el tiempo no acompaña.',
    items: [
      '16:00 – Circuito termal en Spa Bienestar Moaña',
      '18:00 – Salida revitalizada y paseo ligero',
      '20:00 – Cena tranquila en un entorno acogedor'
    ],
    hint: 'Ideal para parejas o un momento de autocuidado.',
    routeCoords: [
      { lat: 42.3320, lng: -8.8143, name: 'A Miudiña' },
      { lat: 42.2858, lng: -8.7360, name: 'Spa Bienestar Moaña' }
    ]
  },
  {
    id: 'exploracion',
    title: 'Plan Exploración',
    emoji: '🚗',
    duration: 'Ruta en coche',
    description: 'Descubre varios puntos de interés sin depender del paraguas en cada parada.',
    items: [
      '11:00 – Salida panorámica desde Bueu',
      '11:20 – Parada técnica en Cangas',
      '12:00 – Rumbo hacia la ensenada de Aldán',
      '12:30 – Parada para café'
    ],
    hint: 'Ves varios sitios sin mojarte apenas.',
    routeCoords: [
      { lat: 42.3320, lng: -8.8143, name: 'Beluso' },
      { lat: 42.2642, lng: -8.7843, name: 'Cangas' },
      { lat: 42.2785, lng: -8.8250, name: 'Aldán' }
    ]
  },
  {
    id: 'ocio',
    title: 'Plan Alternativo',
    emoji: '🎬',
    duration: 'Más ocio y actividad',
    description: 'Para esos días en los que apetece un ambiente más dinámico y urbano.',
    items: [
      '17:00 – Salida hacia Vigo',
      '18:00 – Sesión de cine o tarde de compras',
      '21:00 – Cena en la ciudad de las luces'
    ],
    hint: 'El plan ideal para romper con la rutina habitual.',
    routeCoords: [
      { lat: 42.3320, lng: -8.8143, name: 'Beluso' },
      { lat: 42.2406, lng: -8.7207, name: 'Vigo Centro' }
    ]
  }
];
