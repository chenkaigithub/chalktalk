function() {
   this.label = 'bst';

   function SketchGlyphCommand(name, src, commandCallback) {
      SketchGlyph.call(this, name, src);
      this.execute = commandCallback || function() {};
   }
   SketchGlyphCommand.Null = new SketchGlyphCommand(null, [], null);
   SketchGlyphCommand.compare = function(glyph) { return glyph.WORST_SCORE; },
   SketchGlyphCommand.execute = function(args) {};

   SketchGlyphCommand.compareAll = function(curves, glyphs, tolerance = 500) {
      const drawing = new SketchGlyph(null, curves);

      let best = {glyph : SketchGlyphCommand.Null, score : drawing.WORST_SCORE, idx : -1};
      
      for (let i = 0; i < glyphs.length; i++) {
         const score = drawing.compare(glyphs[i]);
         if (score < best.score) {
            best.glyphMatch = glyphs[i];
            best.score = score;
            best.idx = i;
         }
      }

      return best;
   };

   function CurveStore() {}
   CurveStore.prototype = {
      c : [],
      beginCurve : function() {
         this.c.push([]);   
      },
      addPoint : function(p) {
         this.c[this.c.length - 1].push(p);
      },
      begin : function() {
         this.c = [];
      },
      clear : function() {
         this.c = [];
      },
      get array() {
         return this.c;
      },
      get length() {
         return this.c.length;
      },
      get lastCurve() {
         return this.c[this.c.length - 1];
      },
      get lastPoint() {
         const numCurves = this.c.length;
         const numPoints = this.c[numCurves - 1].length;
         return this.c[numCurves - 1][numPoints - 1];
      },
   };


   this.setupTree = function() {
      this.tree = new BinarySearchTree(this);
      this.tree.root = this.tree.createBSTWithDepth(3);
      this.tree.saveState();
   };

   this.setupGlyphCommands = function() {
      this.cmdGlyphs = [
         new SketchGlyphCommand("pre-order", [
            [[0, 1], [-1, -1], [1, -1]]
         ], function(args) { args.self.tree.preOrder(); }),

         new SketchGlyphCommand("in-order", [
            [[-1, -1], [0, 1], [1, -1]]
         ], function(args) { args.self.tree.inOrder(); }),

         new SketchGlyphCommand("post-order", [
            [[-1, -1], [1, -1], [0, 1]]
         ], function(args) { args.self.tree.postOrder(); }),

         new SketchGlyphCommand("breadth-first", [
            [[0, 1], [-1, 0.75], [1, 0.75], [-1, 0], [1, 0]]
         ], function(args) { args.self.tree.breadthFirst(); })
      ];      
   };

   this.setup = function() {
      //sketchCtx = this;
      this.setupTree();
      this.setupGlyphCommands();

      this.glyphCurves = new CurveStore();
      this.glyphCommandInProgress = false;

      this.isAcceptingInput = true;
   };

   this.initCopy = function() {
      //sketchCtx = this;
      const tree = this.tree;
      if (tree.historyStack.length == 0) {
         return;
      }
      if (tree.isAcceptingInput) {
         tree.historyStack = tree.historyStack.slice(tree.historyStack.length - 1);
      }
      else {
         // COPY THE TREE BEFORE AN OPERATION WAS IN PROGRESS
         tree.historyStack = tree.historyStack.slice(tree.historyStack.length - 2);
         const newBST = tree.historyStack[tree.historyStack.length - 1];
         tree.root = newBST.root;
         tree.isAcceptingInput = true;
         tree.operationMemory.active = false;
         tree.operationMemory.operation = null;
      }
      tree.resetTemporaryGraphics();
   };

   // TODO, WILL SET NODE CENTERS ONLY WHEN DEPTH CHANGES
   // UNUSED
   this._predictTreeLayout = function(node, arr, center = [0, 0], radius = 0.5, xOffset = 5, yOffset = 2, zOffset = 0) {
      if (node === null) {
         return;
      }

      function traverseTree(node, arr, center, radius, parentCenter, parentRadius, xOffset = 5, yOffset = 2, zOffset = 0) {
         // TODO, GIVE THE NEWLY INSERTED OR REMOVED NODE 
         // A DEFAULT CENTER FOR THE TREE STRETCHING ANIMATION
         if (node.center === undefined) {
            return;
         }
         arr.push(center);

         if (node.left !== null) {
            const newCenter = [center[0] - xOffset * radius,center[1] - yOffset * radius];
            traverseTree(node.left, arr, newCenter, radius, center, radius, xOffset / 2);
         }
         if (node.right !== null) {
            const newCenter = [center[0] + xOffset * radius,center[1] - yOffset * radius];
            traverseTree(node.right, arr, newCenter, radius, center, radius, xOffset / 2);
         }
      }

      const depth = this.tree.depth;

      if (depth > 4){
         traverseTree(node, arr, center, radius, undefined, undefined, 20);
      }
      else if (depth > 3){
         traverseTree(node, arr, center, radius, undefined, undefined, 10);
      }
      else if (depth > 0) {
         traverseTree(node, arr, center, radius);
      }
   }

   this.drawNode = function(node, center, radius, parentCenter, parentRadius) {
     const left = center[0] - radius;
     const right = center[0] + radius;
     const bottom = center[1] - radius;
     const top = center[1] + radius;

     node.colorManager.activateColor();
     // DRAW CONTAINER
     mDrawOval([left, bottom], [right, top], 32, PI / 2 - TAU);

     node.colorManager.deactivateColor();

     // DRAW ELEMENT
     textHeight(this.mScale(.4));
     mText(node.value, center, .5, .5, .5);
   };

   // TODO : MOVE DRAW FUNCTIONS INTO THE STRUCTURE ITSELF?
   this._drawTree = function(node, center, radius, xOffset = 5, yOffset = 2) {
      if (node === null) {
         return;
      }

      function drawParentToChildEdge(center, radius, childCenter) {
         if (childCenter == undefined) {
            return;
         }
         const childParentVec = [childCenter[0] - center[0], childCenter[1] - center[1]];
         const childParentDist = sqrt(pow(childParentVec[0], 2) + pow(childParentVec[1], 2));

         const edgeOfParent = [center[0] + radius / childParentDist * childParentVec[0], center[1] + radius / childParentDist * childParentVec[1]];
         const edgeOfChild = [childCenter[0] - radius / childParentDist * childParentVec[0], childCenter[1] - radius / childParentDist * childParentVec[1]];
         mLine(edgeOfParent, edgeOfChild);
      }

      if (this.tree.mustInitializePositions()) {
         node.center = center;
      }

      // TODO : DON'T ADD NEW NODE UNTIL REST OF TREE HAS MOVED TO CORRECT POSITIONS, THIS IS A TEMPORARY FIX
      if (node.center == undefined) {
         return;
      }

      center = node.center;

      this.drawNode(node, center, radius);

      if (node.left !== null) {
         const newCenter = (this.tree.mustInitializePositions()) ?
                        [center[0] - xOffset * radius, center[1] - yOffset * radius] :
                        node.left.center;

         this._drawTree(node.left, newCenter, radius, xOffset / 2);
         drawParentToChildEdge(center, radius, newCenter);
      }
      if (node.right !== null) {
         const newCenter = (this.tree.mustInitializePositions()) ?
                        [center[0] + xOffset * radius, center[1] - yOffset * radius] :
                        node.right.center;

         this._drawTree(node.right, newCenter, radius, xOffset / 2);
         drawParentToChildEdge(center, radius, newCenter);
      }
   };

   this.drawTree = function(node, center, radius, xOffset = 5, yOffset = 2) {
      this._drawTree(node, center, radius, xOffset, yOffset);
      this.tree._mustInitializePositions = false;
   };

   // CHECK IF POINT LIES WITHIN CIRCLE
   this.inCircle = function(node, clickLocation){
      const dist = Math.sqrt((clickLocation[0] - node.center[0]) * (clickLocation[0] - node.center[0]) +
                          (clickLocation[1] - node.center[1]) * (clickLocation[1] - node.center[1]));
      return dist < 0.5;
   };

   this._findClickedNode = function(node, clickLocation) {
      if (!this.inCircle(node, clickLocation)) {
         if (node.center[0] > clickLocation[0]) {
            if (node.left !== null){
               return this.findClickedNode(node.left, clickLocation);
            }
            return null;
         }
         else {
            if (node.right !== null) {
               return this.findClickedNode(node.right, clickLocation);
            }
            return null;
         }
      }
      return node;
   };

   this.findClickedNode = function(node, clickLocation) {
      return (node === null) ?
               null : this._findClickedNode(node, clickLocation);
   };

   // STORE CLICK INFORMATION FROM PREVIOUS FRAMES
   this.clickInfoCache = {
      px : null,
      py : null,
      time : -1
   };


   this.onPress = function(p) {
      if (!this.sketchIsAcceptingInput()) {
         return;
      }

      const ci = this.clickInfoCache;
      ci.x = p.x;
      ci.y = p.y;
      ci.time = time;


      this.tree.resetTemporaryGraphics();
   }

   this.onRelease = function(p) {
      if (!this.sketchIsAcceptingInput()) {
         return;
      }

      const ci = this.clickInfoCache;
      if (abs(p.x - ci.x) < 0.05 &&
          abs(p.y - ci.y) < 0.05) {
         const node = this.findClickedNode(this.tree.root, [ci.x, ci.y]);
         if (node !== null) {
            this.tree.saveState();
            this.tree.remove(node.value);
         }
      }
      ci.x = null;
      ci.y = null;
   }

   this.onSwipe[4] = [
      'undo',
      function() {
         this.tree.restorePast();
      }
   ];

   this.onCmdPress = function(p) {
      if (this.glyphCommandInProgress) {
         return;
      }
      this.tree.resetTemporaryGraphics();
      this.glyphCommandInProgress = true;

      this.glyphCurves.beginCurve();
      this.onCmdDrag(p);
   };
   this.onCmdDrag = function(p) {
      if (!this.glyphCommandInProgress) {
         return;
      }

      this.glyphCurves.addPoint([p.x, p.y]);
   };

   // MORE ACCURATE? 
   this.mouseDown = function(x, y, z) {
      console.log("MOUSEDOWN");
      this.glyphCurves.beginCurve();
      this.mouseDrag(x, y, z);
   }
   this.mouseDrag = function(x, y, z) {
      console.log("MOUSEDRAG");
      // if (!this.glyphCommandInProgress) {
      //    return;
      // }
      this.glyphCurves.addPoint(this.inverseTransform([x, y, z]));
   };
   this.mouseUp = function() {
      console.log("MOUSEUP");
      this.glyphCurves.clear();
   };
   //////////////////////////////////////
   this.onCmdRelease = function(p) {
      if (!this.glyphCommandInProgress) {
         return;
      }

      SketchGlyphCommand.compareAll(
         this.glyphCurves.array,
         this.cmdGlyphs
      ).glyphMatch.execute({self : this});

      this.glyphCurves.clear();
      this.glyphCommandInProgress = false;
   };

   this.onDrag = function(p) {
      if (!this.sketchIsAcceptingInput()) {
         return;
      }

      const ci = this.clickInfoCache;
      // SAVE A POINT "BOUNDARY/"THRESHOLD" FOR COMPARISON
      const point = [p.x, p.y];

      const addedDepth = Math.round((ci.y - point[1]) / 2);
      if (addedDepth !== 0) {
         let newDepth = this.tree.depth + addedDepth;
         newDepth = min(newDepth, 6);
         newDepth = max(newDepth, 0);
         this.tree.root = this.tree.createBSTWithDepth(newDepth);
         this.tree._mustInitializePositions = true;
         if (!(this.tree.depth === 0 && newDepth === 0)) {
            this.tree.saveState();
         }
         this.tree.depth = newDepth;

         ci.y = point[1];
      };
   };

   this.output = function() {
      return this.tree.operationStack;
   }

   this.under = function(other) {
      if (other.output === undefined) {
         return;
      }

      if (this.sketchIsAcceptingInput()) {
         if (other.label && other.label === "BST") {
            console.log("TODO: merge trees operation");
         }
         else {
            let out = other.output();
            out = Number(1 * out);

            if (isNaN(out)) {
               return;
            }

            this.tree.saveState();
            this.tree.insert(out);
         }
      }

      other.fade();
      other.delete();
   };

   this.drawEmpty = function(center, radius) {
      const left = center[0] - radius;
      const right = center[0] + radius;
      const bottom = center[1] - radius;
      const top = center[1] + radius;
      color("grey");
      mDrawOval([left, bottom], [right, top], 32, PI / 2 - TAU);

      color("blue");
      textHeight(this.mScale(.2));
      mText("nullptr", center, .5, .5, .5);
   };


   this.sketchIsAcceptingInput = function() {
      return this.tree.isAcceptingInput;
   };


   // THE ELAPSED TIME MUST BE AVAILABLE AT ALL TIMES, HOW TO ENFORCE?
   this.render = function(elapsed) {
      this.duringSketch(function() {
         mCurve([
            // OUTER
            [-3.75, -2],
            [-2.5, -1],
            [0, 0],
            [2.5, -1],
            [3.75, -2],
         ]);
         mCurve([
            // INNER
            [3.75, -2],
            [1.25, -2],
            [2.5, -1]
         ]);
      });
      this.afterSketch(function() {
         let nodeRadius = 0.5;
         let center = [0, 0];
         let currNode = this.tree.root;

         let depth = this.tree.depth;

         this.tree.doPendingOperation();

         if (depth > 4) {
            this.drawTree(currNode, center, nodeRadius, 20);
         }
         else if (depth > 3) {
            this.drawTree(currNode, center, nodeRadius, 10);
         }
         else if (depth > 0) {
            this.drawTree(currNode, center, nodeRadius);
         }
         else {
            this.drawEmpty(center, nodeRadius);
         }

         _g.save();
         color("cyan");
         lineWidth(1);
         const curves = this.glyphCurves.array;
         for (let i = 0; i < curves.length; i++) {
            mCurve(curves[i]);
         }
         _g.restore();
      });
   };
}
