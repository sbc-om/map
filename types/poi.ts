/**
 * POI (Point of Interest) type definitions
 */

export type POICategory =
  | 'food-drink'
  | 'shopping'
  | 'transport'
  | 'lodging'
  | 'health'
  | 'entertainment'
  | 'nature'
  | 'services'
  | 'education'
  | 'religion'
  | 'business'
  | 'tourism'
  | 'emergency'
  | 'utilities';

export interface POICategoryConfig {
  id: POICategory;
  name: string;
  color: string;
  bgColor: string;
  icon: string;
}

export interface POI {
  id: string;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  category: POICategory;
  createdAt: number;
  updatedAt: number;
}

export interface POIGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
    properties: {
      id: string;
      title: string;
      description?: string;
      category: POICategory;
      createdAt: number;
      updatedAt: number;
    };
  }>;
}
