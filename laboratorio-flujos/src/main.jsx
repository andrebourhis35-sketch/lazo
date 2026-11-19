import React from 'react';
import { createRoot } from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import '@xyflow/react/dist/style.css';
import '@fontsource-variable/manrope';
import CanvasEditor from './CanvasEditor.jsx';

createRoot(document.getElementById('root')).render(<React.StrictMode><CanvasEditor /></React.StrictMode>);
