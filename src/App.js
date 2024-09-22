import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import './App.css';

function App() {
  const [option, setOption] = useState("upload"); // Toggle between 'upload', 'draw', 'erase', and 'rectangle'
  const [image, setImage] = useState(null);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [htmlView, setHtmlView] = useState(""); // HTML preview
  const [isMaximized, setIsMaximized] = useState(false); // Toggle for maximizing the code box
  const [isDrawing, setIsDrawing] = useState(false); // Track if user is drawing
  const [rectangles, setRectangles] = useState([]); // Store drawn rectangles
  const [currentRect, setCurrentRect] = useState(null); // Track the current rectangle being drawn
  const [freehandLines, setFreehandLines] = useState([]); // Store freehand lines
  const canvasRef = useRef(null); // Reference for canvas (whiteboard)
  const [ctx, setCtx] = useState(null); // Canvas drawing context
  const [prompt, setPrompt] = useState(""); // State to store prompt input


  // Initialize canvas drawing context when whiteboard is selected
  useEffect(() => {
    if (option === "whiteboard" && canvasRef.current) {
      const canvas = canvasRef.current;
      setCtx(canvas.getContext("2d"));
    }
  }, [option]);

  // Start drawing or drawing rectangle
  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (option === "rectangle") {

      // Start drawing a rectangle
      setCurrentRect({ x, y, width: 0, height: 0 });
      setIsDrawing(true);
    } else if (option === "draw" || option === "erase") {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);

      if (option === "draw") {
        setFreehandLines((prev) => [...prev, { type: "start", x, y }]);
      }
    }
  };

  // Handle drawing (freehand or rectangles)
  const draw = (e) => {
    if (!isDrawing) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (option === "draw") {
      // Freehand drawing
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.lineTo(x, y);
      ctx.stroke();
      setFreehandLines((prev) => [...prev, { type: "line", x, y }]);
    } else if (option === "erase") {
      // Erase freehand drawings and rectangles
      ctx.strokeStyle = "white"; // Set to white to erase
      ctx.lineWidth = 20;
      ctx.lineTo(x, y);
      ctx.stroke();
      eraseRectangles(x, y); // Erase rectangles
      eraseFreehandLines(x, y); // Erase freehand lines
    } else if (option === "rectangle" && currentRect) {
      // Draw rectangle in progress
      const newWidth = x - currentRect.x;
      const newHeight = y - currentRect.y;

      // Clear and redraw everything to avoid dragging artifacts
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      drawAllRectangles();
      drawAllFreehandLines();
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.strokeRect(currentRect.x, currentRect.y, newWidth, newHeight);

      // Update rectangle dimensions
      setCurrentRect({ ...currentRect, width: newWidth, height: newHeight });
    }
  };

  // Stop drawing
  const stopDrawing = () => {
    if (option === "rectangle" && currentRect) {
      // Add the finished rectangle to the list
      setRectangles([...rectangles, currentRect]);
    }
    setIsDrawing(false);
    ctx.closePath();
  };

  // Draw all rectangles stored in state
  const drawAllRectangles = () => {
    rectangles.forEach((rect) => {
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    });
  };

  // Draw all freehand lines stored in state
  const drawAllFreehandLines = () => {
    if (freehandLines.length === 0) return;

    ctx.beginPath();
    freehandLines.forEach((line) => {
      if (line.type === "start") {
        ctx.moveTo(line.x, line.y);
      } else if (line.type === "line") {
        ctx.lineTo(line.x, line.y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    ctx.closePath();
  };

  // Erase rectangles by detecting intersections
  const eraseRectangles = (x, y) => {
    const newRectangles = rectangles.filter((rect) => {
      const intersects =
        x > rect.x &&
        x < rect.x + rect.width &&
        y > rect.y &&
        y < rect.y + rect.height;
      return !intersects;
    });
    setRectangles(newRectangles);

    // Clear and redraw all remaining rectangles
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    drawAllRectangles();
    drawAllFreehandLines();
  };

  // Erase freehand lines by detecting if the eraser path intersects the line
  // Erase freehand lines by detecting if the eraser path intersects the line segment
const eraseFreehandLines = (x, y) => {
  const eraserSize = 20; // Define the size of the eraser area

  const newLines = [];
  let lastMoveTo = null; // Track the last "start" point

  for (let i = 0; i < freehandLines.length; i++) {
    const line = freehandLines[i];

    if (line.type === "start") {
      // Keep the start points and track them
      newLines.push(line);
      lastMoveTo = line;
    } else if (lastMoveTo) {
      // Check if the current line segment intersects the eraser area
      const lineX1 = lastMoveTo.x;
      const lineY1 = lastMoveTo.y;
      const lineX2 = line.x;
      const lineY2 = line.y;

      // Check if any point on the line segment is within the eraser range
      if (!isLineIntersectingWithEraser(lineX1, lineY1, lineX2, lineY2, x, y, eraserSize)) {
        newLines.push(line); // Keep the line segment if it's not within the eraser area
      } else {
        // If eraser intersects this line, do not add it to newLines (it gets erased)
        lastMoveTo = null; // Reset lastMoveTo to break the line path
      }
    }
  }

  setFreehandLines(newLines);

  // Redraw all remaining lines and rectangles
  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  drawAllRectangles();
  drawAllFreehandLines();
};

// Utility function to check if a line segment intersects with the eraser area
const isLineIntersectingWithEraser = (x1, y1, x2, y2, eraserX, eraserY, eraserSize) => {
  // Calculate the distance from the eraser center to the closest point on the line segment
  const dist = pointToLineDistance(x1, y1, x2, y2, eraserX, eraserY);

  // Return true if the distance is less than or equal to the eraser size
  return dist <= eraserSize;
};

// Utility function to calculate the distance from a point to a line segment
const pointToLineDistance = (x1, y1, x2, y2, px, py) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let nearestX, nearestY;

  if (param < 0) {
    nearestX = x1;
    nearestY = y1;
  } else if (param > 0) {
    nearestX = x2;
    nearestY = y2;
  } else {
    nearestX = x1 + param * C;
    nearestY = y1 + param * D;
  }

  const dx = px - nearestX;
  const dy = py - nearestY;
  return Math.sqrt(dx * dx + dy * dy);
};


  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async () => {
    let base64Image = null;

    if (option === "upload" && !image) {
      alert("Please upload an image");
      return;
    }

    if (option === "upload") {
      const reader = new FileReader();
      reader.onloadend = async () => {
        base64Image = reader.result.split(",")[1]; // Extract base64
        await generateCode(base64Image);
      };
      reader.readAsDataURL(image);
    } else if (option === "whiteboard") {
      const canvas = canvasRef.current;
      base64Image = canvas.toDataURL("image/jpeg").split(",")[1]; // Capture canvas content as base64 image
      await generateCode(base64Image); // Send the captured image to GPT
    }
  };


  const handlePromptSubmit = async () => {
    if (!prompt) return;
  
    setLoading(true);
  
    try {
      const gptResponse = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: `Modify the following HTML based on this request: ${prompt}. Only return the updated HTML without any extra text: \n${response}`,
            },
          ],
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
  
      const updatedHtml = gptResponse.data.choices[0].message.content
        .replace(/```html/g, '') // Remove '''html if present
        .replace(/```/g, '');    // Remove any other ''' if present
  
      setResponse(updatedHtml);  // Update the code display
      setHtmlView(updatedHtml);  // Update the HTML preview
    } catch (error) {
      console.error("Error updating code with GPT", error);
    } finally {
      setLoading(false);
      setPrompt("");  // Clear the prompt input
    }
  };
  
  


  const generateCode = async (base64Image) => {
    setLoading(true);
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Generate HTML for the wireframe sketched in this image. Do not mention any extra stuff, start straight from <Doc>." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 2000,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const cleanResponse = response.data.choices[0].message.content
        .replace(/```html/g, '') // Remove '''html
        .replace(/```/g, '');    // Remove any other '''

      setResponse(cleanResponse);
      setHtmlView(cleanResponse);
    } catch (error) {
      console.error("Error generating response", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className={`left-section ${isMaximized ? 'maximized' : ''}`}>
        {/* Top Left Section */}
        {!isMaximized && (
          <div className="top-left">
            <h2 className="title">Upload or Draw a Wireframe</h2>
            <div className="option-selector">
  <button onClick={() => {
    setOption("upload");
  }} className="upload_button">
    Upload Image
  </button>

  {option === "upload" && (
    <button onClick={() => setOption("whiteboard")} className="draw_button">
      Draw on Whiteboard
    </button>
  )}

  {(option === "whiteboard" || option === "draw" || option === "rectangle" || option === "erase") && (
    <>
      <button onClick={() => setOption("draw")}>Freehand Draw</button>
      <button onClick={() => setOption("rectangle")}>Draw Rectangle</button>
      <button onClick={() => setOption("erase")}>Erase</button>
    </>
  )}
</div>

            {option === "upload" && (
              <div className="image-upload">
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {image && (
                  <div className="image-preview">
                    <img src={URL.createObjectURL(image)} alt="uploaded preview" />
                  </div>
                )}
              </div>
            )}
            {(option === "whiteboard" || option === "draw" || option === "rectangle" || option === "erase") && (
            <div className="whiteboard-section">
              <canvas
                ref={canvasRef}
                width={500}
                height={400}
                style={{ border: '1px solid black' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              ></canvas>
            </div>
          )}

            <button onClick={handleSubmit} disabled={loading} className="save-button">
              {loading ? "Processing..." : "Save & Generate Code"}
            </button>
          </div>
        )}

        {/* Bottom Left Section: Code Display */}
        <div className={`bottom-left ${isMaximized ? 'expanded' : ''}`}>
          <div className="code-header">
            <h3>Generated HTML Code:</h3>
            <button onClick={() => setIsMaximized(!isMaximized)}>
              {isMaximized ? "Minimize" : "Maximize"}
            </button>
          </div>
          <pre className="code-view">{response}</pre>
        </div>
      </div>

      {/* Right Section: HTML Preview */}
      <div className="right-section">
        <h3>HTML Preview:</h3>
        <iframe id="htmlPreview" title="HTML Preview" srcDoc={htmlView} className="html-iframe"></iframe>
        <div className="prompt-box">
  <input
    type="text"
    placeholder="Enter a prompt to modify the code"
    value={prompt}
    onChange={(e) => setPrompt(e.target.value)}
  />
  <button onClick={handlePromptSubmit} className="submit_button">Submit</button>
</div>

      </div>
    </div>
  );
}

export default App;
