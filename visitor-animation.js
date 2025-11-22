/* ============================================
   STATIC PRECISION TOWER (Top-rows only)
   ============================================ */
import { supabase } from './supabase-client.js';

class Block {
  constructor(x, y, size, isActive = false) {
    this.x = x;   // world coords
    this.y = y;
    this.size = size;
    this.isActive = isActive;

    // Impact glow animation state
    this.impactGlowProgress = 0;
    this.isGlowing = false;
    this.ambientGlow = 0; // Influenced by nearby glowing blocks
  }

  triggerImpactGlow() {
    this.isGlowing = true;
    this.impactGlowProgress = 0;
  }

  updateImpactGlow() {
    if (!this.isGlowing) return;

    // Duration: ~1200ms at 60fps = 72 frames (increased from 400ms)
    this.impactGlowProgress += 1/72;

    if (this.impactGlowProgress >= 1) {
      this.impactGlowProgress = 1;
      // instead of instantly killing impact,
      // let ambientGlow handle the long fade-out
      this.isGlowing = false;
      this.ambientGlow = Math.max(this.ambientGlow, 1.0); // give it a strong ambient start
    }
  }

  getGlowIntensity() {
    if (!this.isGlowing && this.ambientGlow === 0) return 0;

    // Ease-out cubic for smooth decay
    const t = this.impactGlowProgress;
    const eased = 1 - Math.pow(t, 3);

    // Primary glow intensity (0 to 1, then fades)
    const primaryGlow = this.isGlowing ? eased : 0;

    // Combined with ambient glow from nearby blocks
    return Math.max(primaryGlow, this.ambientGlow);
  }

  draw(ctx, zoom, offsetY) {
    // Convert world → screen
    if (!isFinite(zoom) || zoom <= 0) return;
    const screenX = ctx.canvas.width / 2 + this.x * zoom + 1;
    const screenY = ctx.canvas.height - (this.y - offsetY) * zoom;
    if (!isFinite(screenX) || !isFinite(screenY)) return;

    // Base block color - bright glowing blue
    ctx.fillStyle = this.isActive ? "#00A3FF" : "#1A1A1A";
    ctx.fillRect(
      screenX,
      screenY,
      this.size * zoom,
      -this.size * zoom // draw upward
    );

    // Simplified glow - just a simple shadow instead of gradients
    if (this.isActive) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#00A3FF";
      ctx.fillStyle = "#00A3FF";
      ctx.fillRect(
        screenX,
        screenY,
        this.size * zoom,
        -this.size * zoom
      );
      ctx.shadowBlur = 0; // Reset shadow
    }

    // Border with thicker line width - bright blue
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.isActive ? "#00D4FF" : "#333";
    ctx.strokeRect(
      screenX,
      screenY,
      this.size * zoom,
      -this.size * zoom
    );
    ctx.lineWidth = 1; // Reset line width
  }
}

class PrecisionTower {

  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    this.blocks = [];
    this.blocksPerRow = 25;
    this.blockSize = 12;
    this.blockGap = 2;
    this.zoom = 1.0;
    this.visitorCount = 0;
    this.fallingBlock = null;

    // ⬇️ NEW — replace your old init stuff with this
    this.initialize();
  }

  // ⬇️ Put initialize() DIRECTLY after constructor
  async initialize() {
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    await this.loadVisitorCount();      // Get latest count from DB
    await this.incrementVisitorCount(); // Add one + save to DB

    document.getElementById("visitor-count").textContent =
      this.visitorCount.toLocaleString();

    this.buildTower(this.visitorCount - 1); // Existing blocks already in DB
    this.setCameraToTopRows();
    this.animate();
    setTimeout(() => this.dropNewBlock(), 200);
  }

  // ⬇️ then loadVisitorCount and incrementVisitorCount below this
  // Load count from DB
async loadVisitorCount() {
  const { data, error } = await supabase
    .from("visitor_tower")
    .select("id, count")
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("❌ loadVisitorCount error:", error);
    this.visitorCount = 1000;
    this.rowId = 1;
  } else {
    this.rowId = data.id;
    this.visitorCount = data.count;
    console.log("📥 Loaded count:", this.visitorCount);
  }
}

// Write incremented count back to DB
async incrementVisitorCount() {
  const newValue = this.visitorCount + 1;

  const { error } = await supabase
    .from("visitor_tower")
    .update({ count: newValue })
    .eq("id", this.rowId);

  if (error) {
    console.error("❌ incrementVisitorCount error:", error);
  } else {
    this.visitorCount = newValue;
    document.getElementById("visitor-count").textContent = this.visitorCount.toLocaleString();
    console.log("📤 Updated count:", this.visitorCount);
  }
}

  
  resizeCanvas() {
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }

  buildTower(count) {
    const rows = Math.ceil(count / this.blocksPerRow);
    let idx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < this.blocksPerRow && idx < count; c++) {
        const x = (c - this.blocksPerRow / 2) * (this.blockSize + this.blockGap);
        const y = r * (this.blockSize + this.blockGap);
        this.blocks.push(new Block(x, y, this.blockSize, false));
        idx++;
      }
    }
    this.totalRows = rows;
  }

  setCameraToTopRows() {
    const topRowFromBottom = this.totalRows - 1;

    // Show top ~5 rows (shifted up by 1 row)
    const showRows = 5;
    const highestVisibleRow = Math.max(topRowFromBottom - showRows + 1, 0);

    // The offset moves world upward so we see this height
    this.offsetY = highestVisibleRow * (this.blockSize + this.blockGap);
  }

  dropNewBlock() {
  const totalBlocks = this.blocks.length;

  // Determine row & column for the new block
  const row = Math.floor(totalBlocks / this.blocksPerRow);  // 0-based row index from bottom
  const col = totalBlocks % this.blocksPerRow;              // 0-based col index

  const rowHeight = this.blockSize + this.blockGap;

  // World coordinates: center tower horizontally
  const x = (col - this.blocksPerRow / 2) * rowHeight;
  const targetY = row * rowHeight;
  const startY = targetY + 200;  // Start 200px above the target

  // Create falling block
  this.fallingBlock = {
    block: new Block(x, startY, this.blockSize, false),
    targetY: targetY,
    startY: startY,
    progress: 0
  };
}

  updateFallingBlock() {
    if (!this.fallingBlock) return;

    this.fallingBlock.progress += 0.018 ; // Constant speed fall

    if (this.fallingBlock.progress >= 1) {
      this.fallingBlock.progress = 1;
      this.fallingBlock.block.y = this.fallingBlock.targetY;

      // Turn the falling block blue on impact
      this.fallingBlock.block.isActive = true;

      // Propagate glow to nearby blocks
      this.propagateGlowToNearby(this.fallingBlock.block);

      this.blocks.push(this.fallingBlock.block);
      this.fallingBlock = null;
    } else {
      // Linear motion - no acceleration
      const t = this.fallingBlock.progress;
      this.fallingBlock.block.y = this.fallingBlock.startY - (this.fallingBlock.startY - this.fallingBlock.targetY) * t;
    }
  }

  propagateGlowToNearby(sourceBlock) {
    const rowHeight = this.blockSize + this.blockGap;
    const maxDistance = this.totalRows * rowHeight;
    const rippleSpeed = 60; // ms per row distance - initial speed
    const speedUpTime = 3000; // Speed doubles after 3 seconds
    const fastSpeed = 30; // Double speed after 3 seconds

    // Turn the source block blue first (impact point)
    sourceBlock.isActive = true;

    // Store activation time for each block instead of using setTimeout
    this.rippleStartTime = performance.now();
    this.rippleBlocks = [];

    for (const block of this.blocks) {
      // Skip blocks that are already blue
      if (block.isActive) continue;

      // Distance from impact point (sourceBlock)
      const dx = block.x - sourceBlock.x;
      const dy = block.y - sourceBlock.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Normalized distance (0 to 1)
      const norm = distance / maxDistance;

      // Calculate delay with speed increase after 3 seconds
      let delay = norm * rippleSpeed * this.totalRows;

      if (delay > speedUpTime) {
        // Distance covered in first 3 seconds at normal speed
        const normAt3Seconds = speedUpTime / (rippleSpeed * this.totalRows);
        // Remaining distance at double speed
        delay = speedUpTime + (norm - normAt3Seconds) * fastSpeed * this.totalRows;
      }

      // Store the block and its activation time
      this.rippleBlocks.push({ block, activationTime: delay });
    }

    // Trigger global zoom afterward
    this.zoomStartTime = 500;
  }

  startZoom() {
    this.isZooming = true;
    this.zoomProgress = 0;
    this.zoomStart = this.zoom;

    // Calculate zoom to fit entire tower with padding
    const rowHeight = this.blockSize + this.blockGap;
    const towerHeight = this.totalRows * rowHeight;
    const towerWidth = this.blocksPerRow * (this.blockSize + this.blockGap);

    // Add 10% padding
    const paddingFactor = 1.1;

    // Calculate zoom needed for height and width
    const zoomForHeight = (this.canvas.height / (towerHeight * paddingFactor));
    const zoomForWidth = (this.canvas.width / (towerWidth * paddingFactor));

    // Use the smaller zoom to ensure everything fits
    this.zoomTarget = Math.min(zoomForHeight, zoomForWidth);

    // Start pan at the same time as zoom
    this.startPan();
  }

  updateZoom() {
    if (!this.isZooming) return;

    this.zoomProgress += 0.008; // Slower zoom speed for dramatic effect

    if (this.zoomProgress >= 1) {
      this.zoomProgress = 1;
      this.isZooming = false;
    }

    // Ease-out cubic for smooth deceleration
    const t = this.zoomProgress;
    const eased = 1 - Math.pow(1 - t, 3);

    this.zoom = this.zoomStart + (this.zoomTarget - this.zoomStart) * eased;
  }

  startPan() {
    this.isPanning = true;
    this.panProgress = 0;
    this.panStartY = this.offsetY;
    this.panTargetY = 0; // Pan to bottom of tower
  }

  updatePan() {
    if (!this.isPanning) return;

    // Slower pan speed
    this.panProgress += 0.006;

    if (this.panProgress >= 1) {
      this.panProgress = 1;
      this.isPanning = false;
    }

    // Ease-in-out cubic for slower start, faster middle, slower end
    const t = this.panProgress;
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    this.offsetY = this.panStartY + (this.panTargetY - this.panStartY) * eased;
  }

  updateRipple() {
    if (!this.rippleBlocks || this.rippleBlocks.length === 0) return;

    const elapsed = performance.now() - this.rippleStartTime;

    // Activate blocks whose time has come
    this.rippleBlocks = this.rippleBlocks.filter(({ block, activationTime }) => {
      if (elapsed >= activationTime) {
        block.isActive = true;
        return false; // Remove from array
      }
      return true; // Keep in array
    });

    // Start zoom when it's time
    if (this.zoomStartTime && elapsed >= this.zoomStartTime && !this.isZooming) {
      this.startZoom();
      this.zoomStartTime = null;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    this.updateFallingBlock();
    this.updateRipple();
    this.updateZoom();
    this.updatePan();

    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const b of this.blocks) {
      b.draw(this.ctx, this.zoom, this.offsetY);
    }

    if (this.fallingBlock) {
      this.fallingBlock.block.draw(this.ctx, this.zoom, this.offsetY);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PrecisionTower("visitor-canvas");
});
