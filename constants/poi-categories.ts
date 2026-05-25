/**
 * POI category configurations
 */

import type { POICategoryConfig } from '@/types/poi';

export const POI_CATEGORIES: POICategoryConfig[] = [
  {
    id: 'food-drink',
    name: 'Food & Drink',
    color: '#f97316', // Orange
    bgColor: '#fed7aa',
    icon: '🍽️',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    color: '#a855f7', // Purple
    bgColor: '#e9d5ff',
    icon: '🛍️',
  },
  {
    id: 'transport',
    name: 'Transport',
    color: '#3b82f6', // Blue
    bgColor: '#bfdbfe',
    icon: '🚌',
  },
  {
    id: 'lodging',
    name: 'Lodging',
    color: '#06b6d4', // Cyan
    bgColor: '#a5f3fc',
    icon: '🏨',
  },
  {
    id: 'health',
    name: 'Health',
    color: '#ef4444', // Red
    bgColor: '#fecaca',
    icon: '🏥',
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    color: '#eab308', // Yellow
    bgColor: '#fef08a',
    icon: '🎭',
  },
  {
    id: 'nature',
    name: 'Nature',
    color: '#22c55e', // Green
    bgColor: '#bbf7d0',
    icon: '🌳',
  },
  {
    id: 'services',
    name: 'Services',
    color: '#1e40af', // Dark Blue
    bgColor: '#93c5fd',
    icon: '🔧',
  },
  {
    id: 'education',
    name: 'Education',
    color: '#14b8a6', // Teal
    bgColor: '#99f6e4',
    icon: '🎓',
  },
  {
    id: 'religion',
    name: 'Religion',
    color: '#92400e', // Brown
    bgColor: '#d6d3d1',
    icon: '⛪',
  },
  {
    id: 'business',
    name: 'Business',
    color: '#6b7280', // Gray
    bgColor: '#d1d5db',
    icon: '💼',
  },
  {
    id: 'tourism',
    name: 'Tourism',
    color: '#ec4899', // Pink
    bgColor: '#fbcfe8',
    icon: '📸',
  },
  {
    id: 'emergency',
    name: 'Emergency',
    color: '#991b1b', // Red Dark
    bgColor: '#fca5a5',
    icon: '🚨',
  },
  {
    id: 'utilities',
    name: 'Utilities',
    color: '#374151', // Dark Gray
    bgColor: '#9ca3af',
    icon: '⚡',
  },
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
