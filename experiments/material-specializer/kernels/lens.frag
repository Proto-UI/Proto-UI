
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        varying vec2 v_uv;
        uniform sampler2D u_tex;
        uniform vec2  u_resolution;
        uniform vec2  u_textureResolution;
        uniform vec4  u_bounds;
        uniform float u_refraction;
        uniform float u_aberration;
        uniform float u_bevelDepth;
        uniform float u_bevelWidth;
        uniform float u_frost;
        uniform float u_radius;
        uniform float u_time;
        uniform bool  u_specular;
        uniform float u_revealProgress;
        uniform int   u_revealType;
        uniform float u_tiltX;
        uniform float u_tiltY;
        uniform float u_magnify;
        uniform vec2  u_subpixel;
        uniform vec2  u_boxSize;
        uniform vec4  u_tint;
        uniform sampler2D u_stack;
        uniform vec4 u_stackMapping;
        uniform vec4 u_stackRegion;
        uniform vec4 u_interaction;
        uniform float u_interactionRadius;
        uniform sampler2D u_shadow;
        uniform vec4 u_shadowMapping;

        vec4 sampleSource(vec2 uv) {
          vec4 background = texture2D(u_tex, uv);
          vec2 screenUV = u_stackMapping.xy + uv * u_stackMapping.zw;
          if (u_stackRegion.z > 0.0 &&
              all(greaterThanEqual(screenUV, u_stackRegion.xy)) &&
              all(lessThanEqual(screenUV, u_stackRegion.xy + u_stackRegion.zw))) {
            vec4 lower = texture2D(u_stack, vec2(screenUV.x, 1.0 - screenUV.y));
            return lower + background * (1.0 - lower.a);
          }
          return background;
        }

        float udRoundBox( vec2 p, vec2 b, float r ) {
          return length(max(abs(p)-b+r,0.0))-r;
        }

        vec2 cornerNormal( vec2 p, vec2 b, float r, vec2 fallback ) {
          vec2 q = abs(p) - b + r;
          vec2 m = max(q, 0.0);
          float l = length(m);
          if (l <= 0.0) return fallback;
          float w = smoothstep(0.0, max(r * 0.5, 1.0), min(m.x, m.y));
          if (w <= 0.0) return fallback;
          vec2 s = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
          return normalize(mix(fallback, s * (m / l), w));
        }

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        vec2 deformPoint(vec2 point) {
          if (u_interactionRadius <= 0.0) return point;
          vec2 centre = (vec2(u_interaction.x, 1.0 - u_interaction.y) - 0.5) * u_boxSize;
          float reach = u_interactionRadius * min(u_boxSize.x, u_boxSize.y);
          float influence = 1.0 - smoothstep(0.0, reach, length(point - centre));
          return point - vec2(u_interaction.z, -u_interaction.w) * u_boxSize * influence;
        }

        float edgeFactor(vec2 p_px, vec2 b_px, float radius_px){
          float d = -udRoundBox(p_px, b_px, radius_px);
          float bevel_px = u_bevelWidth * min(u_boxSize.x, u_boxSize.y);
          return 1.0 - smoothstep(0.0, bevel_px, d);
        }
        void main(){
          vec2 lensUV = (v_uv * u_resolution - u_subpixel) / u_boxSize;
          vec2 originalPoint = (lensUV - 0.5) * u_boxSize;
          vec2 p_px = deformPoint(originalPoint);
          vec2 b_px = 0.5 * u_boxSize;
          vec2 p = p_px / u_boxSize.y;
          float dmask = udRoundBox(p_px, b_px, u_radius);
          float inShape = 1.0 - smoothstep(-0.5, 0.5, dmask);
          float shadowAlpha = 0.0;
          if (u_shadowMapping.z > 0.0 && inShape < 1.0) {
            vec2 shadowUV = u_shadowMapping.xy + vec2(lensUV.x, 1.0 - lensUV.y) * u_shadowMapping.zw;
            shadowAlpha = texture2D(u_shadow, shadowUV).r * 0.1 * (1.0 - inShape);
            if (u_revealType == 1) shadowAlpha *= u_revealProgress;
            float noise = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
            shadowAlpha = floor(shadowAlpha * 255.0 + noise) / 255.0;
          }
          if (inShape <= 0.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, shadowAlpha);
            return;
          }

          float edge = edgeFactor(p_px, b_px, u_radius);
          float min_dimension = min(u_resolution.x, u_resolution.y);
          float offsetAmt = (edge * u_refraction + pow(edge, 10.0) * u_bevelDepth);
          float centreBlend = smoothstep(0.15, 0.45, length(p));
          vec2 refractDir = cornerNormal(p_px, b_px, u_radius, normalize(p + vec2(0.000001)));
          if (u_interactionRadius > 0.0) {
            vec2 gradient = vec2(
              udRoundBox(deformPoint(originalPoint + vec2(0.5, 0.0)), b_px, u_radius) - udRoundBox(deformPoint(originalPoint - vec2(0.5, 0.0)), b_px, u_radius),
              udRoundBox(deformPoint(originalPoint + vec2(0.0, 0.5)), b_px, u_radius) - udRoundBox(deformPoint(originalPoint - vec2(0.0, 0.5)), b_px, u_radius)
            );
            if (length(gradient) > 0.0001) refractDir = normalize(mix(refractDir, normalize(gradient), min(length(p_px - originalPoint), 1.0)));
          }
          vec2 offset = refractDir * offsetAmt * centreBlend;

          float tiltRefractionScale = 0.05;
          vec2 tiltOffset = vec2(tan(radians(u_tiltY)), -tan(radians(u_tiltX))) * tiltRefractionScale;

          vec2 localUV = (lensUV - 0.5) / u_magnify + 0.5;
          vec2 flippedUV = vec2(localUV.x, 1.0 - localUV.y);
          vec2 mapped = u_bounds.xy + flippedUV * u_bounds.zw;
          vec2 refracted = mapped + offset - tiltOffset;

          float oob = max(max(-refracted.x, refracted.x - 1.0), max(-refracted.y, refracted.y - 1.0));
          float blend = 1.0 - smoothstep(0.0, 0.01, oob);
          vec2 sampleUV = mix(mapped, refracted, blend);

          vec4 baseCol   = sampleSource(mapped);

          vec2 texel = 1.0 / u_textureResolution;
          vec4 refrCol;

          vec2 chroma = offset * u_aberration;

          if (u_frost > 0.0) {
              float radius = u_frost * 4.0;
              vec4 sum = vec4(0.0);
              const int SAMPLES = 16;

              for (int i = 0; i < SAMPLES; i++) {
                  float angle = random(v_uv + float(i)) * 6.283185;
                  float dist = sqrt(random(v_uv - float(i))) * radius;
                  vec2 foff = vec2(cos(angle), sin(angle)) * texel * dist;
                  if (u_aberration > 0.0) {
                      sum.r += sampleSource(sampleUV + foff - chroma).r;
                      sum.g += sampleSource(sampleUV + foff).g;
                      sum.b += sampleSource(sampleUV + foff + chroma).b;
                      sum.a += sampleSource(sampleUV + foff).a;
                  } else {
                      sum += sampleSource(sampleUV + foff);
                  }
              }
              refrCol = sum / float(SAMPLES);
          } else {
              refrCol = sampleSource(sampleUV);
              refrCol += sampleSource(sampleUV + vec2( texel.x, 0.0));
              refrCol += sampleSource(sampleUV + vec2(-texel.x, 0.0));
              refrCol += sampleSource(sampleUV + vec2(0.0,  texel.y));
              refrCol += sampleSource(sampleUV + vec2(0.0, -texel.y));
              refrCol /= 5.0;

              if (u_aberration > 0.0) {
                  refrCol.r = sampleSource(sampleUV - chroma).r;
                  refrCol.b = sampleSource(sampleUV + chroma).b;
              }
          }

          if (refrCol.a < 0.1) {
              refrCol = baseCol;
          }

          float diff = clamp(length(refrCol.rgb - baseCol.rgb) * 4.0, 0.0, 1.0);

          float antiHalo = (1.0 - centreBlend) * diff;

          vec4 final    = refrCol;

          final.rgb = mix(final.rgb, final.rgb * u_tint.rgb, u_tint.a);

          if (u_specular) {
            vec2 lp1 = vec2(sin(u_time*0.2), cos(u_time*0.3))*0.6 + 0.5;
            vec2 lp2 = vec2(sin(u_time*-0.4+1.5), cos(u_time*0.25-0.5))*0.6 + 0.5;
            float h = 0.0;
            h += smoothstep(0.4,0.0,distance((p_px + b_px) / u_boxSize, lp1))*0.1;
            h += smoothstep(0.5,0.0,distance((p_px + b_px) / u_boxSize, lp2))*0.08;
            final.rgb += h;
          }

          if (u_revealType == 1) {
              final.rgb *= u_revealProgress;
              final.a  *= u_revealProgress;
          }

          final.rgb *= inShape;
          final.a = final.a * inShape + shadowAlpha;

          gl_FragColor = final;
        }