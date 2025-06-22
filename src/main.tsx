import { createRoot } from "react-dom/client";
import "./index.css";

function App() {
  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-4xl font-bold text-center text-black">
        Lab Table Scanner Working!
      </h1>
      <p className="text-center mt-4 text-black">
        React is now mounting properly.
      </p>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
} else {
  console.error("Root element not found");
}
