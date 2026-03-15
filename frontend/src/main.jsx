import React from 'react'
import * as ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client'
import * as Jotai from 'jotai'

// 曝露给插件使用
window.React = React;
window.ReactDOM = ReactDOM;
window.Jotai = Jotai;
import './css/style.css'
import App from './App'
import { registerAPI } from './SDK/Binding'

registerAPI();

const container = document.getElementById('root')

const root = createRoot(container)

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
