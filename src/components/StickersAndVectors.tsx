import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  G,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Ellipse,
  Line,
} from 'react-native-svg';

/**
 * Etiqueta rosa pálido con borde ondulado (forma de nube) y línea fina roja interior
 */
export const CloudBadgeSVG: React.FC<{ width?: number; height?: number }> = ({
  width = 230,
  height = 126,
}) => (
  <Svg width={width} height={height} viewBox="0 0 230 126" fill="none">
    {/* Sombra suave de la etiqueta */}
    <Path
      d="M42 22 C52 8, 76 8, 88 18 C102 6, 128 6, 142 18 C154 8, 178 8, 188 22 C208 24, 220 42, 214 63 C220 84, 208 102, 188 104 C178 118, 154 118, 142 108 C128 120, 102 120, 88 108 C76 118, 52 118, 42 104 C22 102, 10 84, 16 63 C10 42, 22 24, 42 22 Z"
      fill="rgba(80, 20, 24, 0.14)"
      transform="translate(2, 4)"
    />
    {/* Cuerpo rosa pálido */}
    <Path
      d="M42 22 C52 8, 76 8, 88 18 C102 6, 128 6, 142 18 C154 8, 178 8, 188 22 C208 24, 220 42, 214 63 C220 84, 208 102, 188 104 C178 118, 154 118, 142 108 C128 120, 102 120, 88 108 C76 118, 52 118, 42 104 C22 102, 10 84, 16 63 C10 42, 22 24, 42 22 Z"
      fill="#FADADD"
      stroke="#E8B4B8"
      strokeWidth="1.5"
    />
    {/* Línea fina roja interior siguiendo el contorno ondulado */}
    <Path
      d="M46 28 C55 16, 75 16, 87 25 C101 14, 129 14, 143 25 C155 16, 175 16, 184 28 C201 30, 211 45, 205 63 C211 81, 201 96, 184 98 C175 110, 155 110, 143 101 C129 112, 101 112, 87 101 C75 110, 55 110, 46 98 C29 96, 19 81, 25 63 C19 45, 29 30, 46 28 Z"
      fill="none"
      stroke="#B92B27"
      strokeWidth="1.3"
    />
  </Svg>
);

/**
 * Corazón individual estilo acuarela pintado a mano
 */
export const WatercolorHeartSVG: React.FC<{
  size?: number;
  rotation?: number;
  opacity?: number;
}> = ({ size = 22, rotation = 0, opacity = 0.85 }) => (
  <View style={{ transform: [{ rotate: `${rotation}deg` }], opacity }}>
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Defs>
        <SvgGradient id="wcHeart" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#D63447" stopOpacity="0.92" />
          <Stop offset="65%" stopColor="#B82332" stopOpacity="0.82" />
          <Stop offset="100%" stopColor="#E56B6F" stopOpacity="0.7" />
        </SvgGradient>
      </Defs>
      {/* Mancha de acuarela secundaria para efecto húmedo */}
      <Path
        d="M16 27.5 C16 27.5 4.5 19.2 4.5 11.2 C4.5 6.8 8.1 4 11.8 4 C14.1 4 15.6 5.4 16.3 6.8 C17 5.4 18.5 4 20.8 4 C24.5 4 27.8 6.8 27.8 11.2 C27.8 19.2 16 27.5 16 27.5 Z"
        fill="url(#wcHeart)"
      />
      <Path
        d="M11 7.5 C9.2 7.8 7.6 9.5 7.8 11.6"
        stroke="#FFD6D6"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity={0.55}
      />
    </Svg>
  </View>
);

/**
 * Sticker botánico de flores naranjas secas (Centro-Izquierda página izquierda)
 */
export const DriedOrangeFlowersSVG: React.FC<{ width?: number; height?: number }> = ({
  width = 88,
  height = 115,
}) => (
  <Svg width={width} height={height} viewBox="0 0 90 120" fill="none">
    {/* Halo blanco de sticker troquelado */}
    <Path
      d="M42 112 C35 88, 22 65, 18 42 C15 24, 28 10, 46 10 C64 10, 77 24, 73 45 C69 68, 56 89, 48 112 Z"
      fill="#FFFDF9"
      stroke="#E6DEC8"
      strokeWidth="1.5"
    />
    {/* Tallos secos */}
    <Path
      d="M45 106 C44 82, 37 58, 30 34 M45 106 C47 80, 55 56, 61 32 M45 106 L45 24"
      stroke="#6E5A3F"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* Hojas secas */}
    <Path d="M43 75 C34 70, 29 62, 34 58 C40 60, 43 68, 43 75 Z" fill="#8C7A5B" />
    <Path d="M47 68 C56 63, 61 55, 56 51 C50 53, 47 61, 47 68 Z" fill="#9E8B66" />
    {/* Pétalos de flores naranjas secas */}
    <G transform="translate(28, 30)">
      <Circle cx="0" cy="0" r="10" fill="#D96B27" />
      <Circle cx="-4" cy="-3" r="6" fill="#E8833A" />
      <Circle cx="3" cy="2" r="5" fill="#C45119" />
      <Circle cx="0" cy="0" r="3" fill="#5C2C12" />
    </G>
    <G transform="translate(46, 21)">
      <Circle cx="0" cy="0" r="11" fill="#E07A2E" />
      <Circle cx="3" cy="-3" r="7" fill="#F09348" />
      <Circle cx="-3" cy="3" r="6" fill="#C85A17" />
      <Circle cx="0" cy="0" r="3.5" fill="#5C2C12" />
    </G>
    <G transform="translate(61, 34)">
      <Circle cx="0" cy="0" r="9.5" fill="#D45D1E" />
      <Circle cx="-2" cy="-2" r="6" fill="#E8833A" />
      <Circle cx="0" cy="0" r="2.8" fill="#5C2C12" />
    </G>
    {/* Cinta adhesiva semi-transparente arriba */}
    <Rect
      x="30"
      y="92"
      width="30"
      height="10"
      rx="1"
      fill="rgba(245, 232, 199, 0.78)"
      transform="rotate(-8 45 97)"
    />
  </Svg>
);

/**
 * Código de barras vertical estilo ticket vintage
 */
export const VerticalBarcodeSVG: React.FC<{ height?: number }> = ({ height = 104 }) => {
  const bars = [2, 1, 3, 1, 2, 1, 4, 1, 2, 2, 1, 3, 1, 2, 1, 3, 2, 1, 2];
  let currentY = 6;
  return (
    <Svg width={24} height={height} viewBox={`0 0 24 ${height}`} fill="none">
      <Rect x="0" y="0" width="24" height={height} fill="#F7F1E1" rx="2" />
      {bars.map((barHeight, idx) => {
        const y = currentY;
        currentY += barHeight + 2.5;
        if (y + barHeight > height - 6) return null;
        return (
          <Rect
            key={idx}
            x="4"
            y={y}
            width={idx % 4 === 0 ? 16 : 13}
            height={barHeight}
            fill="#2B2623"
          />
        );
      })}
    </Svg>
  );
};

/**
 * Sticker vintage de un querubín / ángel (Abajo en el centro)
 */
export const VintageCherubSVG: React.FC<{ size?: number }> = ({ size = 76 }) => (
  <Svg width={size} height={size} viewBox="0 0 84 84" fill="none">
    {/* Borde troquelado estilo sticker */}
    <Circle cx="42" cy="42" r="37" fill="#FFFDF8" stroke="#E2D9C5" strokeWidth="1.5" />
    {/* Alas barrocas suaves */}
    <Path
      d="M40 44 C26 30, 11 32, 14 47 C16 55, 28 56, 38 51 Z"
      fill="#EFE6D5"
      stroke="#B8A990"
      strokeWidth="1.3"
    />
    <Path
      d="M44 44 C58 30, 73 32, 70 47 C68 55, 56 56, 46 51 Z"
      fill="#EFE6D5"
      stroke="#B8A990"
      strokeWidth="1.3"
    />
    {/* Cuerpo y brazos apoyados */}
    <Ellipse cx="42" cy="54" rx="14" ry="10" fill="#F5D5C6" />
    {/* Cabeza del querubín */}
    <Circle cx="42" cy="36" r="11.5" fill="#F7DDD0" stroke="#C9A696" strokeWidth="1" />
    {/* Rizos dorados vintage */}
    <Circle cx="34" cy="28" r="4.5" fill="#D4A359" />
    <Circle cx="40" cy="25" r="5" fill="#DDA95B" />
    <Circle cx="47" cy="26" r="4.5" fill="#D4A359" />
    <Circle cx="52" cy="31" r="4" fill="#C9964C" />
    <Circle cx="31" cy="34" r="3.8" fill="#C9964C" />
    {/* Mejillas sonrojadas y rostro sereno */}
    <Circle cx="37.5" cy="38" r="2.2" fill="#E89993" opacity={0.6} />
    <Circle cx="46.5" cy="38" r="2.2" fill="#E89993" opacity={0.6} />
    <Path d="M36 35 Q38 36.5 40 35" stroke="#6E4F42" strokeWidth="1.2" strokeLinecap="round" />
    <Path d="M44 35 Q46 36.5 48 35" stroke="#6E4F42" strokeWidth="1.2" strokeLinecap="round" />
    <Path d="M40 41 Q42 42.5 44 41" stroke="#A65E58" strokeWidth="1.2" strokeLinecap="round" />
    {/* Pequeño corazón rojo entre las manos */}
    <Path
      d="M42 56 C42 56 36 51.5 36 48 C36 46 37.8 44.8 39.5 44.8 C40.8 44.8 41.6 45.6 42 46.5 C42.4 45.6 43.2 44.8 44.5 44.8 C46.2 44.8 48 46 48 48 C48 51.5 42 56 42 56 Z"
      fill="#C92A2A"
    />
  </Svg>
);

/**
 * Ramo de rosas blancas envuelto en papel kraft (Sección derecha abajo)
 */
export const WhiteRosesBouquetSVG: React.FC<{ width?: number; height?: number }> = ({
  width = 86,
  height = 110,
}) => (
  <Svg width={width} height={height} viewBox="0 0 90 115" fill="none">
    {/* Contorno de sticker */}
    <Path
      d="M22 30 C16 16, 36 8, 46 10 C58 8, 76 16, 70 32 L56 104 C52 109, 38 109, 34 104 Z"
      fill="#FFFDF9"
      stroke="#E5DEC9"
      strokeWidth="1.4"
    />
    {/* Follaje verde eucalipto */}
    <Circle cx="28" cy="30" r="10" fill="#5D7A58" />
    <Circle cx="62" cy="30" r="10" fill="#4E6B49" />
    <Circle cx="45" cy="20" r="11" fill="#688763" />
    {/* Rosas blancas en capas */}
    <G transform="translate(34, 30)">
      <Circle cx="0" cy="0" r="9.5" fill="#FAF8F2" stroke="#D8D2C5" strokeWidth="1" />
      <Path d="M-4 -2 C-1 -5, 4 -3, 3 2 C1 5, -4 4, -4 -2 Z" stroke="#C7BFA8" strokeWidth="1.2" />
      <Circle cx="0" cy="0" r="2.2" fill="#EFE6C8" />
    </G>
    <G transform="translate(54, 31)">
      <Circle cx="0" cy="0" r="9.5" fill="#FAF8F2" stroke="#D8D2C5" strokeWidth="1" />
      <Path d="M-3 -3 C1 -5, 5 -2, 3 3 C0 5, -4 3, -3 -3 Z" stroke="#C7BFA8" strokeWidth="1.2" />
      <Circle cx="0" cy="0" r="2.2" fill="#EFE6C8" />
    </G>
    <G transform="translate(44, 21)">
      <Circle cx="0" cy="0" r="10" fill="#FFFFFF" stroke="#D8D2C5" strokeWidth="1" />
      <Path d="M-4 -1 C0 -5, 5 -2, 3 3 C0 5, -5 3, -4 -1 Z" stroke="#C7BFA8" strokeWidth="1.2" />
      <Circle cx="0" cy="0" r="2.5" fill="#F2E8C4" />
    </G>
    <G transform="translate(45, 38)">
      <Circle cx="0" cy="0" r="9" fill="#FFFDF9" stroke="#D8D2C5" strokeWidth="1" />
      <Circle cx="0" cy="0" r="2.2" fill="#EFE6C8" />
    </G>
    {/* Envoltorio cónico de papel periódico / kraft */}
    <Path
      d="M23 41 L67 41 L53 101 C49 104, 41 104, 37 101 Z"
      fill="#EADBC8"
      stroke="#CBB69B"
      strokeWidth="1.2"
    />
    <Path d="M23 41 L45 56 L67 41" fill="#F5EBE0" stroke="#D5C3AA" strokeWidth="1" />
    {/* Lazo rojo atando el ramo */}
    <Rect x="36" y="68" width="18" height="4.5" rx="2" fill="#B92B27" />
    <Path d="M45 72 L39 83 M45 72 L51 83" stroke="#B92B27" strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

/**
 * Lomo de cuaderno en Alta Definición (HD):
 * Hendidura central realista, brillo de curvatura de página y costuras artesanales con hilo marfil.
 * Reemplaza el difuminado borroso por un centro nítido y detallado.
 */
export const HDSpineBindingSVG: React.FC<{ height?: number; width?: number }> = ({
  height = 600,
  width = 36,
}) => {
  const stitchCount = 13;
  const stitchSpacing = height / (stitchCount + 1);
  const midX = width / 2;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <Defs>
        <SvgGradient id="spineCurvatureHD" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#2E2016" stopOpacity="0.01" />
          <Stop offset="30%" stopColor="#2E2016" stopOpacity="0.14" />
          <Stop offset="47%" stopColor="#1B120B" stopOpacity="0.32" />
          <Stop offset="50%" stopColor="#100A06" stopOpacity="0.5" />
          <Stop offset="52%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <Stop offset="68%" stopColor="#2E2016" stopOpacity="0.14" />
          <Stop offset="100%" stopColor="#2E2016" stopOpacity="0.01" />
        </SvgGradient>
      </Defs>

      {/* Sombra de curvatura suave y definida del lomo */}
      <Rect x="0" y="0" width={width} height={height} fill="url(#spineCurvatureHD)" />

      {/* Hendidura profunda central ultra nítida */}
      <Line
        x1={midX - 0.5}
        y1="0"
        x2={midX - 0.5}
        y2={height}
        stroke="#23170E"
        strokeWidth="1.2"
        opacity={0.65}
      />
      {/* Brillo 3D adyacente que le da nitidez HD */}
      <Line
        x1={midX + 0.8}
        y1="0"
        x2={midX + 0.8}
        y2={height}
        stroke="#FFFFFF"
        strokeWidth="1"
        opacity={0.55}
      />

      {/* Puntadas de encuadernación artesanales en hilo color marfil */}
      {Array.from({ length: stitchCount }).map((_, i) => {
        const y = stitchSpacing * (i + 1);
        return (
          <G key={`stitch-${i}`}>
            {/* Perforación de aguja izquierda */}
            <Circle cx={midX - 5} cy={y} r="1.4" fill="#1C130D" opacity={0.75} />
            <Circle cx={midX - 5} cy={y - 0.5} r="0.8" fill="#000000" opacity={0.4} />

            {/* Perforación de aguja derecha */}
            <Circle cx={midX + 5} cy={y} r="1.4" fill="#1C130D" opacity={0.75} />
            <Circle cx={midX + 5} cy={y - 0.5} r="0.8" fill="#000000" opacity={0.4} />

            {/* Sombra tenue debajo del hilo */}
            <Line
              x1={midX - 5}
              y1={y + 1}
              x2={midX + 5}
              y2={y + 1}
              stroke="#2B1A0E"
              strokeWidth="1"
              opacity={0.35}
            />

            {/* Hilo de costura artesanal tenso cruzando el lomo */}
            <Line
              x1={midX - 5}
              y1={y}
              x2={midX + 5}
              y2={y}
              stroke="#F8F3E6"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </G>
        );
      })}
    </Svg>
  );
};
