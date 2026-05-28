/**
 * POI (Point of Interest) type definitions
 */

export type POICategory =
  | 'food-drink'
  | 'cafe'
  | 'shopping'
  | 'market'
  | 'transport'
  | 'parking'
  | 'fuel'
  | 'lodging'
  | 'health'
  | 'entertainment'
  | 'sports'
  | 'nature'
  | 'beach'
  | 'services'
  | 'bank'
  | 'education'
  | 'religion'
  | 'mosque'
  | 'business'
  | 'government'
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
