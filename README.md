<div align="center">

# 📐 Euclides Web
### Dynamic Geometry & Artificial Intelligence

> *"There is no royal road to geometry."* — Euclid

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Gemini API](https://img.shields.io/badge/AI-Gemini_Flash-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/bassani)

[Live Demo](https://euclides-web.vercel.app/) • [Technical Documentation (Architecture)](./ARCHITECTURE.md) • [Report Bug](https://github.com/seu-usuario/euclides-web/issues)

</div>

---

## 📑 Table of Contents
- [About the Project](#-about-the-project)
- [Features](#-features)
- [How to Use](#-how-to-use)
- [Development Guide](#-development-guide)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Support the Project](#-support-the-project)
- [License](#-license)

---

## 🔭 About the Project

**Euclides Web** is a reimagine of classical geometry tools (ruler and compass) for the Artificial Intelligence era.

Unlike purely mathematical software like GeoGebra, Euclides Web incorporates an **AI Persona** trained to act as Euclid of Alexandria himself. He doesn't just calculate; he teaches, demonstrates, and engages in Socratic dialogue with the student, utilizing the infinite canvas as his digital papyrus.

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| **🤖 AI Mentor** | A chat integrated with the Gemini API (Google) that "sees" the board and can create shapes, explain theorems, or correct constructions. |
| **📐 Infinite Canvas** | A virtual Cartesian plane with infinite zoom and pan, rendered in vector SVG for maximum precision. |
| **🧲 Smart Snap** | Magnetic attraction system that automatically detects intersections, midpoints, and grid alignments. |
| **📱 Mobile First** | Responsive interface with multi-touch gesture support (pinch-to-zoom, two-finger pan). |
| **⚡ Performance** | Built with React 19 and optimized rendering, ensuring 60 FPS even with complex constructions. |
| **💾 Persistence** | Your theorems and sketches are automatically saved in the browser. |

---

## 🚀 How to Use

### For Students and Teachers
1. **Access:** Open the [Live Demo](#).
2. **Explore:** Use the bottom bar to select tools (Point, Line, Circle).
3. **Interact:** Click the Chat button and ask: *"Master, draw an equilateral triangle."*
4. **Learn:** Watch as the AI manipulates the board in real-time.

---

## 🛠 Development Guide

Follow these steps to run the project locally.

### Prerequisites
*   **Node.js** 18 or higher.
*   An API key from [Google AI Studio](https://aistudio.google.com/).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/seu-usuario/euclides-web.git
    cd euclides-web
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Create a `.env` file in the project root (or set in terminal):
    ```bash
    export API_KEY="your_google_api_key_here"
    ```

4.  **Run:**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173`.

---

## 🏗 Project Structure

For a deep dive into the architecture (Clean Code, SOLID, Design Patterns), read **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

Quick directory summary:
*   `components/canvas`: SVG rendering components (dumb/presentational).
*   `hooks/`: Business logic and state management (smart/container).
*   `services/`: Gemini API integration.
*   `utils/`: Pure math (intersections, analytic geometry).

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add: AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## ☕ Support the Project

If Euclides Web has been useful for your studies or teaching, consider supporting continuous development by buying me a coffee! This helps keep the code clean, servers running, and the AI smart.

<a href="https://buymeacoffee.com/bassani" target="_blank">
<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" >
</a>

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">
  <br />
  <sub>Developed with ❤️ and geometry.</sub>
</div>