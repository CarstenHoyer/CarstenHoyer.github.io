class ShaderProgram {
    mouse = {}
    sampleNum = 0;
    time = 0;
    
    copyVideo = [false, false]
    constructor(canvas) {
      var gl = canvas.getContext("webgl");
      if (!gl) {
          throw new Error("WebGL not supported");
      }
      var self = this

      canvas.addEventListener('mousemove', function(event) {
        var rect = event.target.getBoundingClientRect();
        self.mouse.x = event.clientX - rect.left;
        self.mouse.y = event.clientY - rect.top;
      })

      canvas.addEventListener('click', function(event) {
        if (self.sampleNum === 2) {
          self.sampleNum = 0;
        } else {
          self.sampleNum++;
        }
        console.log(self.sampleNum)
      })

      // Vertex shader program
      var vsSource = `
        // an attribute will receive data from a buffer
        attribute vec2 a_position;
        attribute vec2 a_textureCoord;

        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        uniform float u_sample_num;
        
        varying mediump vec2 v_uv;
        varying mediump vec2 v_textureCoord;
        varying mediump vec2 v_mouse;
        varying mediump float v_sample_num;

  

        // all shaders have a main function
        void main() {
          // convert the position from pixels to 0.0 to 1.0
          vec2 zeroToOne = a_position / u_resolution;
      
          // convert from 0->1 to 0->2
          vec2 zeroToTwo = zeroToOne * 2.0;
      
          // convert from 0->2 to -1->+1 (clip space)
          vec2 clipSpace = zeroToTwo - 1.0;
      
          vec2 flippedClipSpace = clipSpace * vec2(1, -1);

          gl_Position = vec4(flippedClipSpace, 0, 1);

          v_textureCoord = a_textureCoord / u_resolution;
          v_mouse = u_mouse;
          v_uv = u_resolution;
          v_sample_num = u_sample_num;
        }
      `;

      // Fragment shader program
      var fsSource = `
        // fragment shaders don't have a default precision so we need
        // to pick one. mediump is a good default
        precision mediump float;

        #define PI 3.1415926538

        varying mediump vec2 v_uv;
        varying mediump vec2 v_textureCoord;
        varying mediump vec2 v_mouse;
        varying mediump float v_sample_num;

        uniform sampler2D u_sampler0;
        uniform sampler2D u_sampler1;
        uniform sampler2D u_sampler2;

        uniform float u_time;

        vec3 mod289(vec3 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec2 mod289(vec2 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec3 permute(vec3 x) {
          return mod289(((x*34.0)+10.0)*x);
        }

        float snoise(vec2 v)
          {
          const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                              0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                            -0.577350269189626,  // -1.0 + 2.0 * C.x
                              0.024390243902439); // 1.0 / 41.0
        // First corner
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v -   i + dot(i, C.xx);

        // Other corners
          vec2 i1;
          //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
          //i1.y = 1.0 - i1.x;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          // x0 = x0 - 0.0 + 0.0 * C.xx ;
          // x1 = x0 - i1 + 1.0 * C.xx ;
          // x2 = x0 - 1.0 + 2.0 * C.xx ;
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;

        // Permutations
          i = mod289(i); // Avoid truncation effects in permutation
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));

          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m ;
          m = m*m ;

        // Gradients: 41 points uniformly over a line, mapped onto a diamond.
        // The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;

        // Normalise gradients implicitly by scaling m
        // Approximation of: m *= inversesqrt( a0*a0 + h*h );
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

        // Compute final noise value at P
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        vec4 DirectionalBlur(in vec2 uv, in vec2 direction, in float intensity, in sampler2D texture)
        {
          float smoosh = 0.5;
          vec4 color = vec4(0.0);
          const int samples = 128;
          for (int i = 1; i <= samples/2; i++) {
            color += texture2D(texture,uv+float(i)*intensity/float(samples/2)*direction);
            color += texture2D(texture,uv-float(i)*intensity/float(samples/2)*direction);
          }
    
          return color/float(samples);    
        }

        float atan2(in float y, in float x) {
          float a = 0.0;
        
          if(x > 0.0){
            a = atan(y/x);
          } else if (x < 0.0 && y >= 0.0){
             a = atan(y/x) + PI;
          } else if(x < 0.0 && y < 0.0){
            a = atan(y/x) - PI;
          } else if(x == 0.0 && y > 0.0){
             a = PI * 0.5;
          } else if(x == 0.0 && y < 0.0){
            a = -PI * 0.5;
          }
        
          return a;
        }

        void main() {
          vec2 zeroToOne = v_mouse.xy / v_uv.xy;
          vec2 zeroToTwo = zeroToOne * 2.0;
          vec2 clipSpace = zeroToTwo - 1.0;
          vec2 flippedClipSpace = clipSpace * vec2(1, -1);

          float dis = distance(flippedClipSpace, vec2(0.0));
          float intensity = mix(0.0, 0.08, dis);
          float angle = atan2(flippedClipSpace.y, flippedClipSpace.x);
          vec2 direction = vec2(cos(angle), -sin(angle));
          vec4 color = vec4(0.0);

          float frequency = 10.0;
          float amp = 100.0;
          float noise = snoise(vec2(v_textureCoord.x * frequency, 0.0));

          if (v_sample_num == 0.0) {
            color = DirectionalBlur(v_textureCoord,normalize(direction),intensity,u_sampler0);
          } else if (v_sample_num == 1.0) {
            color = DirectionalBlur(v_textureCoord,normalize(direction),intensity,u_sampler1);
          } else if (v_sample_num == 2.0) {
            color = DirectionalBlur(v_textureCoord,normalize(direction),intensity,u_sampler2);
          }
          gl_FragColor = color;
        }
      `;

      // Initialize a shader program; this is where all the lighting
      // for the vertices and so forth is established.
      const shaderProgram = this.initShaderProgram(gl, vsSource, fsSource);

      // Collect all the info needed to use the shader program.
      // Look up which attributes our shader program is using
      // for aVertexPosition, aVertexColor and also
      // look up uniform locations.
      const programInfo = {
        program: shaderProgram,
        attribLocations: {
          positionAttributeLocation: gl.getAttribLocation(shaderProgram, "a_position"),
          textureCoord: gl.getAttribLocation(shaderProgram, 'a_textureCoord'),
        },
        uniformLocations: {
          mouseUniformLocation: gl.getUniformLocation(shaderProgram, 'u_mouse'),
          uSampler0: gl.getUniformLocation(shaderProgram, 'u_sampler0'),
          uSampler1: gl.getUniformLocation(shaderProgram, 'u_sampler1'),
          uSampler2: gl.getUniformLocation(shaderProgram, 'u_sampler2'),
          resolutionUniformLocation: gl.getUniformLocation(shaderProgram, "u_resolution"),
          whichSamplerUniformLocation: gl.getUniformLocation(shaderProgram, "u_sample_num"),
          timeUniformLocation: gl.getUniformLocation(shaderProgram, "u_time"),
        },
      }

      // Here's where we call the routine that builds all the
      // objects we'll be drawing.
      const buffers = this.initBuffers(gl);

      const textures = {
        texture0: this.initTexture(gl),
        texture1: this.initTexture(gl),
        texture2: this.initTexture(gl)
      }

      const videos = [
        {
          video: this.setupVideo('deren_small.mp4', 0),
          texture: textures.texture0,
        },
        {
          video: this.setupVideo('kenneth_small.mp4', 1),
          texture: textures.texture1,
        },
        {
          video: this.setupVideo('stan_small.mp4', 2),
          texture: textures.texture2,
        }
      ]

      var then = 0;
      var self = this;

      // Draw the scene repeatedly
      function render(now) {
        now *= 0.001;  // convert to seconds
        const deltaTime = now - then;
        then = now;

        videos.forEach((video, i) => {
          if (self.copyVideo[i]) {
            self.updateTexture(gl, video.texture, video.video);
          }
        })

        self.drawScene(gl, programInfo, buffers, textures, deltaTime);

        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    }

    //
    // copy the video texture
    //
    updateTexture(gl, texture, video) {
      const level = 0;
      const internalFormat = gl.RGBA;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, video);
    }

    setupVideo(url, index) {
      const video = document.createElement('video');
    
      var playing = false;
      var timeupdate = false;
    
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
    
      // Waiting for these 2 events ensures
      // there is data in the video
    
      video.addEventListener('playing', function() {
         playing = true;
         checkReady();
      }, true);
    
      video.addEventListener('timeupdate', function() {
         timeupdate = true;
         checkReady();
      }, true);
    
      video.src = url;
      video.play();

      let self = this;
    
      function checkReady() {
        if (playing && timeupdate) {
          self.copyVideo[index] = true;
        }
      }
    
      return video;
    }

    //
    // Initialize a texture.
    //
    initTexture(gl, url) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // Because video havs to be download over the internet
      // they might take a moment until it's ready so
      // put a single pixel in the texture so we can
      // use it immediately.
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1.46;
      const height = 1;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    width, height, border, srcFormat, srcType,
                    pixel);

      // Turn off mips and set  wrapping to clamp to edge so it
      // will work regardless of the dimensions of the video.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      return texture;
    }

    //
    // initBuffers
    //
    // Initialize the buffers we'll need. For this demo, we just
    // have one object -- a simple two-dimensional square.
    //
    initBuffers(gl) {
      var positionBuffer = gl.createBuffer();

      // Select the positionBuffer as the one to apply buffer
      // operations to from here out.

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

      // Now create an array of positions for the texture.
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

      const positions = [
        0, 0,
        gl.canvas.clientWidth, 0,
        0, gl.canvas.clientHeight,
        0, gl.canvas.clientHeight,
        gl.canvas.clientWidth, 0,
        gl.canvas.clientWidth, gl.canvas.clientHeight,
      ];

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

      // Now set up the texture coordinates.

      const textureCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

      const textureCoordinates = [
        0, 0,
        gl.canvas.clientWidth, 0,
        0, gl.canvas.clientHeight,
        0, gl.canvas.clientHeight,
        gl.canvas.clientWidth, 0,
        gl.canvas.clientWidth, gl.canvas.clientHeight,
      ];

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                    gl.STATIC_DRAW);
                    
      return {
        position: positionBuffer,
        textureCoord: textureCoordBuffer,
      };
    }

    //
    // Initialize a shader program, so WebGL knows how to draw our data
    //
    initShaderProgram(gl, vsSource, fsSource) {
      const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
      const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

      // Create the shader program

      const shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      // If creating the shader program failed, alert

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
      }

      return shaderProgram;
    }

    //
    // creates a shader of the given type, uploads the source and
    // compiles it.
    //
    loadShader(gl, type, source) {
      const shader = gl.createShader(type);

      // Send the source to the shader object

      gl.shaderSource(shader, source);

      // Compile the shader program

      gl.compileShader(shader);

      // See if it compiled successfully

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    }


    resizeCanvasToDisplaySize(canvas) {
      // Lookup the size the browser is displaying the canvas in CSS pixels.
      const displayWidth  = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
     
      // Check if the canvas is not the same size.
      const needResize = canvas.width  !== displayWidth ||
                         canvas.height !== displayHeight;
     
      if (needResize) {
        // Make the canvas the same size
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
      }
     
      return needResize;
    }

    //
    // Draw the scene.
    //
    drawScene(gl, programInfo, buffers, textures, deltaTime) {
      this.resizeCanvasToDisplaySize(gl.canvas);
      this.time += deltaTime;

      // Tell WebGL how to convert from clip space to pixels
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to black, fully opaque
      //gl.clearDepth(1.0);                 // Clear everything
      //gl.enable(gl.DEPTH_TEST);           // Enable depth testing
      //gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

      // Clear the canvas before we start drawing on it.

      gl.clear(gl.COLOR_BUFFER_BIT);

      // Create a perspective matrix, a special matrix that is
      // used to simulate the distortion of perspective in a camera.
      // Our field of view is 45 degrees, with a width/height
      // ratio that matches the display size of the canvas
      // and we only want to see objects between 0.1 units
      // and 100 units away from the camera.

      // const fieldOfView = 45 * Math.PI / 180;   // in radians
      // const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      // const zNear = 0.1;
      // const zFar = 100.0;
      // const projectionMatrix = mat4.create();

      // // note: glmatrix.js always has the first argument
      // // as the destination to receive the result.
      // mat4.perspective(projectionMatrix,
      //                 fieldOfView,
      //                 aspect,
      //                 zNear,
      //                 zFar);

      // Set the drawing position to the "identity" point, which is
      // the center of the scene.
      // const modelViewMatrix = mat4.create();

      // Now move the drawing position a bit to where we want to
      // start drawing the square.

      // mat4.translate(modelViewMatrix,     // destination matrix
      //               modelViewMatrix,     // matrix to translate
      //               [-0.0, 0.0, -3.0]);  // amount to translate


      // Tell WebGL how to pull out the texture coordinates from
      // the texture coordinate buffer into the textureCoord attribute.
      // {
      //   const numComponents = 2;
      //   const type = gl.FLOAT;
      //   const normalize = false;
      //   const stride = 0;
      //   const offset = 0;
      //   gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
      //   gl.vertexAttribPointer(
      //       programInfo.attribLocations.textureCoord,
      //       numComponents,
      //       type,
      //       normalize,
      //       stride,
      //       offset);
      //   gl.enableVertexAttribArray(
      //       programInfo.attribLocations.textureCoord);
      // }

      // Tell WebGL to use our program when drawing

      gl.useProgram(programInfo.program);

      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.enableVertexAttribArray(
          programInfo.attribLocations.positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
          programInfo.attribLocations.positionAttributeLocation,
          numComponents,
          type,
          normalize,
          stride,
          offset);
      }

      // Tell WebGL how to pull out the texture coordinates from
      // the texture coordinate buffer into the textureCoord attribute.
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
            programInfo.attribLocations.textureCoord,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.textureCoord);
      }        

      // Set the shader uniforms

      // set the resolution
      gl.uniform2f(programInfo.uniformLocations.resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

      // set the which sample to show
      gl.uniform1f(programInfo.uniformLocations.whichSamplerUniformLocation, this.sampleNum);

      // set time
      gl.uniform1f(programInfo.uniformLocations.timeUniformLocation, this.time);

      // set mouse loc
      
      gl.uniform2f(programInfo.uniformLocations.mouseUniformLocation, this.mouse.x, this.mouse.y);

      // gl.uniformMatrix4fv(
      //     programInfo.uniformLocations.projectionMatrix,
      //     false,
      //     projectionMatrix);
      // gl.uniformMatrix4fv(
      //     programInfo.uniformLocations.modelViewMatrix,
      //     false,
      //     modelViewMatrix);

      // gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

      // Specify the texture to map onto the faces.

      // Tell WebGL we want to affect texture unit 0
      gl.activeTexture(gl.TEXTURE0);

      // // Bind the texture to texture unit 0
      gl.bindTexture(gl.TEXTURE_2D, textures.texture0);

      // // Tell the shader we bound the texture to texture unit 0
      gl.uniform1i(programInfo.uniformLocations.uSampler0, 0);

      // Tell WebGL we want to affect texture unit 1
      gl.activeTexture(gl.TEXTURE1);

      // Bind the texture to texture unit 1
      gl.bindTexture(gl.TEXTURE_2D, textures.texture1);

      // Tell the shader we bound the texture to texture unit 1
      gl.uniform1i(programInfo.uniformLocations.uSampler1, 1);

      // Tell WebGL we want to affect texture unit 1
      gl.activeTexture(gl.TEXTURE2);

      // Bind the texture to texture unit 1
      gl.bindTexture(gl.TEXTURE_2D, textures.texture2);

      // Tell the shader we bound the texture to texture unit 1
      gl.uniform1i(programInfo.uniformLocations.uSampler2, 2);

      {
        const offset = 0;
        const vertexCount = 6;
        gl.drawArrays(gl.TRIANGLES, offset, vertexCount);
      }
    }
}