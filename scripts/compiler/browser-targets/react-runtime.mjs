// Bundle these CommonJS packages together so every public facade sees one
// React module identity and browser execution needs no runtime require().
import React from 'react';
import ReactDOM from 'react-dom';
import ReactClient from 'react-dom/client';
export { React, ReactDOM, ReactClient };
