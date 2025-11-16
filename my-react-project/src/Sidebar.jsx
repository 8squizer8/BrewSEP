import React, { useState } from "react";
import "./App.css";

const Sidebar = ({ onSelect }) => {
  const [active, setActive] = useState("Option1");
  const [isVisible, setIsVisible] = useState(true);

  const handleClick = (option) => {
    setActive(option);
    if (onSelect) onSelect(option);
  };

  const toggleSidebar = () => {
    setIsVisible(!isVisible);
  };

  return (
    <>
      {/* Toggle button for mobile */}
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        {isVisible ? "×" : "☰"}
      </div>

      {/* Overlay for mobile */}
      {isVisible && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

      {/* Sidebar container */}
      <div className={`sidebar ${isVisible ? "" : "hidden"}`}>
        <div className="sidebar-logo">Menu</div>
        <div className="sidebar-menu">
          <button
            className={active === "Option1" ? "active" : ""}
            onClick={() => handleClick("Option1")}
          >
            Option 1
          </button>
          <button
            className={active === "Option2" ? "active" : ""}
            onClick={() => handleClick("Option2")}
          >
            Option 2
          </button>
          <button
            className={active === "Option3" ? "active" : ""}
            onClick={() => handleClick("Option3")}
          >
            Option 3
          </button>
          <button
            className={active === "Option4" ? "active" : ""}
            onClick={() => handleClick("Option4")}
          >
            Option 4
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
