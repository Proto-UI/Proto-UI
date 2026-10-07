export const OWNED_STYLE = 'block w-16 h-8 p-2 p-4 bg-gray-100 bg-[#04c] opacity-50 opacity-100';
export const CALLER_STYLE = 'p-1 bg-yellow-300';
export const STYLE_TOKENS = [...new Set(`${OWNED_STYLE} ${CALLER_STYLE} p-8`.split(' '))];
