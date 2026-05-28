/**
 * POI category configurations
 */

import type { POICategoryConfig } from '@/types/poi';

export const POI_CATEGORIES: POICategoryConfig[] = [
  // ── Food & Beverage ──
  { id: 'food-drink',   name: 'Food & Drink',   color: '#f97316', bgColor: '#ffedd5', icon: '🍽️' },
  { id: 'cafe',         name: 'Café',            color: '#b45309', bgColor: '#fef3c7', icon: '☕' },
  // ── Retail ──
  { id: 'shopping',     name: 'Shopping',        color: '#a855f7', bgColor: '#f3e8ff', icon: '🛍️' },
  { id: 'market',       name: 'Market & Souk',   color: '#7c3aed', bgColor: '#ede9fe', icon: '🏪' },
  // ── Mobility ──
  { id: 'transport',    name: 'Transport',       color: '#3b82f6', bgColor: '#dbeafe', icon: '🚌' },
  { id: 'parking',      name: 'Parking',         color: '#2563eb', bgColor: '#bfdbfe', icon: '🅿️' },
  { id: 'fuel',         name: 'Fuel Station',    color: '#dc2626', bgColor: '#fee2e2', icon: '⛽' },
  // ── Accommodation ──
  { id: 'lodging',      name: 'Lodging',         color: '#0891b2', bgColor: '#cffafe', icon: '🏨' },
  // ── Health ──
  { id: 'health',       name: 'Health',          color: '#ef4444', bgColor: '#fecaca', icon: '🏥' },
  // ── Leisure ──
  { id: 'entertainment',name: 'Entertainment',   color: '#eab308', bgColor: '#fef9c3', icon: '🎭' },
  { id: 'sports',       name: 'Sports & Gym',    color: '#16a34a', bgColor: '#dcfce7', icon: '🏋️' },
  // ── Nature & Outdoors ──
  { id: 'nature',       name: 'Nature',          color: '#22c55e', bgColor: '#bbf7d0', icon: '🌳' },
  { id: 'beach',        name: 'Beach & Coast',   color: '#0284c7', bgColor: '#e0f2fe', icon: '🏖️' },
  // ── Finance & Services ──
  { id: 'bank',         name: 'Bank & ATM',      color: '#059669', bgColor: '#d1fae5', icon: '🏦' },
  { id: 'services',     name: 'Services',        color: '#1e40af', bgColor: '#bfdbfe', icon: '🔧' },
  // ── Education & Culture ──
  { id: 'education',    name: 'Education',       color: '#14b8a6', bgColor: '#ccfbf1', icon: '🎓' },
  { id: 'tourism',      name: 'Tourism',         color: '#ec4899', bgColor: '#fce7f3', icon: '📸' },
  // ── Religion ──
  { id: 'mosque',       name: 'Mosque',          color: '#0d9488', bgColor: '#ccfbf1', icon: '🕌' },
  { id: 'religion',     name: 'Religion',        color: '#92400e', bgColor: '#fde68a', icon: '⛪' },
  // ── Civic ──
  { id: 'government',   name: 'Government',      color: '#4b5563', bgColor: '#f1f5f9', icon: '🏛️' },
  { id: 'business',     name: 'Business',        color: '#6b7280', bgColor: '#e5e7eb', icon: '💼' },
  // ── Safety ──
  { id: 'emergency',    name: 'Emergency',       color: '#991b1b', bgColor: '#fee2e2', icon: '🚨' },
  { id: 'utilities',    name: 'Utilities',       color: '#374151', bgColor: '#e2e8f0', icon: '⚡' },
];

/**
 * Get category config by ID
 */
export function getCategoryById(id: string): POICategoryConfig | undefined {
  return POI_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * Get category color by ID
 */
export function getCategoryColor(id: string): string {
  return getCategoryById(id)?.color || '#6b7280';
}

/**
 * Get category background color by ID
 */
export function getCategoryBgColor(id: string): string {
  return getCategoryById(id)?.bgColor || '#d1d5db';
}
