import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing application root');
createRoot(container).render(React.createElement(App));
