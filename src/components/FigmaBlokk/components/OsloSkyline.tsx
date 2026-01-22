import React, { CSSProperties } from 'react';
import { useSkylineLights } from '../hooks/useSkylineLights';

interface OsloSkylineProps {
  fadeOpacity: number;
  blockTransform?: string;
  isExpanded?: boolean;
  selectedSolution?: string | null;
  hideBlockAnimation?: boolean;
  className?: string;
  viewBox?: string;
  preserveAspectRatio?: string;
  style?: CSSProperties;
  enableLights?: boolean;
  pinEnebolig?: boolean;
  pinBlock?: boolean;
}

const DEFAULT_BLOCK_TRANSFORM = 'translate(0, 0) scale(1)';
const DEFAULT_VIEW_BOX = '0 -300 1728 652';
const DEFAULT_PRESERVE_ASPECT_RATIO = 'xMidYMax slice';
const DEFAULT_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '100%',
  overflow: 'visible',
};

export const OsloSkyline: React.FC<OsloSkylineProps> = ({
  fadeOpacity,
  blockTransform: _blockTransform = DEFAULT_BLOCK_TRANSFORM,
  isExpanded: _isExpanded,
  selectedSolution: _selectedSolution,
  hideBlockAnimation = false,
  className = 'oslo-skyline',
  viewBox = DEFAULT_VIEW_BOX,
  preserveAspectRatio = DEFAULT_PRESERVE_ASPECT_RATIO,
  style,
  enableLights = false,
  pinEnebolig = false,
  pinBlock,
}) => {
  const { svgRef } = useSkylineLights({ enabled: enableLights });
  const blockTransition = hideBlockAnimation
    ? 'opacity 1s ease-in-out'
    : 'transform 2s ease-in-out, opacity 1s ease-in-out';

  return (
    <svg 
      className={className}
      viewBox={viewBox} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio={preserveAspectRatio}
      ref={svgRef}
      style={{ 
        ...DEFAULT_STYLE,
        ...style,
      }}
    >
      {/* Buildings that fade out */}
      <g style={{ opacity: fadeOpacity, transition: 'opacity 1s ease-in-out' }}>
        <path d="M1620.3 191.642H1548.51H1512.6V119.506V0.593262H1620.3V191.642Z" fill="#F8F0DD"/>
        <path d="M1300.28 351.876H1244.9H1217.2V219.221V0.593262H1300.28V351.876Z" fill="#D0BFAE"/>
        <path d="M1407.98 351.876H1336.19H1300.28V219.221V0.593262H1407.98V351.876Z" fill="#F8F0DD"/>
        <path d="M1447.98 351.877H1355.67H1309.51V289.047V185.48H1447.98V351.877Z" fill="#D0BFAE"/>
        <path d="M1728 351.877H1541.31H1447.98V289.047V185.48H1728V351.877Z" fill="#F8F0DD"/>
        <path d="M1512.6 185.479H1457.21H1429.52V115.654V0.593262H1512.6V185.479Z" fill="#D0BFAE"/>
        {/* Window details for fading buildings */}
        <path d="M1291.05 154.666H1275.67V170.073H1291.05V154.666Z" fill="#2A2859"/>
        <path d="M1266.43 154.666H1251.05V170.073H1266.43V154.666Z" fill="#2A2859"/>
        <path d="M1241.82 154.666H1226.43V170.073H1241.82V154.666Z" fill="#2A2859"/>
        <path d="M1291.05 188.562H1275.67V203.969H1291.05V188.562Z" fill="#2A2859"/>
        <path d="M1266.43 188.562H1251.05V203.969H1266.43V188.562Z" fill="#2A2859"/>
        <path d="M1241.82 188.562H1226.43V203.969H1241.82V188.562Z" fill="#2A2859"/>
        <path d="M1291.05 222.457H1275.67V237.864H1291.05V222.457Z" fill="#2A2859"/>
        <path d="M1266.43 222.457H1251.05V237.864H1266.43V222.457Z" fill="#2A2859"/>
        <path d="M1241.82 222.457H1226.43V237.864H1241.82V222.457Z" fill="#2A2859"/>
        <path d="M1291.05 256.352H1275.67V271.759H1291.05V256.352Z" fill="#2A2859"/>
        <path d="M1266.43 256.352H1251.05V271.759H1266.43V256.352Z" fill="#2A2859"/>
        <path d="M1241.82 256.352H1226.43V271.759H1241.82V256.352Z" fill="#2A2859"/>
        <path d="M1291.05 290.247H1275.67V305.654H1291.05V290.247Z" fill="#2A2859"/>
        <path d="M1266.43 290.247H1251.05V305.654H1266.43V290.247Z" fill="#2A2859"/>
        <path d="M1241.82 290.247H1226.43V305.654H1241.82V290.247Z" fill="#2A2859"/>
        <path d="M1241.82 99.1976H1226.43V123.849H1241.82V99.1976Z" fill="#2A2859"/>
        <path d="M1266.43 99.1976H1251.05V123.849H1266.43V99.1976Z" fill="#2A2859"/>
        <path d="M1291.05 99.1976H1275.67V123.849H1291.05V99.1976Z" fill="#2A2859"/>
        <path d="M1398.75 154.666H1383.36V170.073H1398.75V154.666Z" fill="#2A2859"/>
        <path d="M1374.13 154.666H1358.75V170.073H1374.13V154.666Z" fill="#2A2859"/>
        <path d="M1349.52 154.666H1334.13V170.073H1349.52V154.666Z" fill="#2A2859"/>
        <path d="M1324.9 154.666H1309.51V170.073H1324.9V154.666Z" fill="#2A2859"/>
        <path d="M1324.9 99.1976H1309.51V123.849H1324.9V99.1976Z" fill="#2A2859"/>
        <path d="M1349.52 99.1976H1334.13V123.849H1349.52V99.1976Z" fill="#2A2859"/>
        <path d="M1374.13 99.1976H1358.75V123.849H1374.13V99.1976Z" fill="#2A2859"/>
        <path d="M1398.75 99.1976H1383.36V123.849H1398.75V99.1976Z" fill="#2A2859"/>
        <path d="M1411.06 311.817H1395.67V333.387H1411.06V311.817Z" fill="#2A2859"/>
        <path d="M1435.67 287.166V265.596H1420.29V287.166H1411.06V265.596H1395.67V287.166H1386.44V265.596H1371.06V287.166H1361.82V265.596H1346.44V287.166H1337.21V265.596H1321.82V287.166H1309.51V296.41H1447.98V287.166H1435.67Z" fill="#2A2859"/>
        <path d="M1435.67 311.817H1420.29V333.387H1435.67V311.817Z" fill="#2A2859"/>
        <path d="M1386.44 311.817H1371.05V333.387H1386.44V311.817Z" fill="#2A2859"/>
        <path d="M1361.82 311.817H1346.44V333.387H1361.82V311.817Z" fill="#2A2859"/>
        <path d="M1337.21 311.817H1321.82V333.387H1337.21V311.817Z" fill="#2A2859"/>
        <path d="M1728 185.48H1447.98V194.724H1728V185.48Z" fill="#2A2859"/>
        <path d="M1718.77 287.166V265.596H1703.38V287.166H1694.15V265.596H1678.76V287.166H1669.53V265.596H1654.15V287.166H1644.92V265.596H1629.53V287.166H1620.3V265.596H1604.91V287.166H1595.68V265.596H1580.3V287.166H1571.07V265.596H1555.68V287.166H1546.45V265.596H1531.06V287.166H1521.83V265.596H1506.45V287.166H1497.22V265.596H1481.83V287.166H1472.6V265.596H1457.21V287.166H1447.98V296.41H1728V287.166H1718.77Z" fill="#2A2859"/>
        <path d="M1546.45 311.817H1531.07V333.387H1546.45V311.817Z" fill="#2A2859"/>
        <path d="M1521.83 311.817H1506.45V333.387H1521.83V311.817Z" fill="#2A2859"/>
        <path d="M1497.22 311.817H1481.83V333.387H1497.22V311.817Z" fill="#2A2859"/>
        <path d="M1472.6 311.817H1457.21V333.387H1472.6V311.817Z" fill="#2A2859"/>
        <path d="M1644.92 311.817H1629.53V333.387H1644.92V311.817Z" fill="#2A2859"/>
        <path d="M1620.3 311.817H1604.92V333.387H1620.3V311.817Z" fill="#2A2859"/>
        <path d="M1595.69 311.817H1580.3V333.387H1595.69V311.817Z" fill="#2A2859"/>
        <path d="M1571.07 311.817H1555.68V333.387H1571.07V311.817Z" fill="#2A2859"/>
        <path d="M1718.77 311.817H1703.38V333.387H1718.77V311.817Z" fill="#2A2859"/>
        <path d="M1694.15 311.817H1678.77V333.387H1694.15V311.817Z" fill="#2A2859"/>
        <path d="M1669.54 311.817H1654.15V333.387H1669.54V311.817Z" fill="#2A2859"/>
        <path d="M1503.37 154.666H1487.99V170.073H1503.37V154.666Z" fill="#2A2859"/>
        <path d="M1478.76 154.666H1463.37V170.073H1478.76V154.666Z" fill="#2A2859"/>
        <path d="M1454.14 154.666H1438.75V170.073H1454.14V154.666Z" fill="#2A2859"/>
        <path d="M1454.14 99.1976H1438.75V123.849H1454.14V99.1976Z" fill="#2A2859"/>
        <path d="M1478.76 99.1976H1463.37V123.849H1478.76V99.1976Z" fill="#2A2859"/>
        <path d="M1503.37 99.1976H1487.99V123.849H1503.37V99.1976Z" fill="#2A2859"/>
        <path d="M1611.07 154.666H1595.69V170.073H1611.07V154.666Z" fill="#2A2859"/>
        <path d="M1586.45 154.666H1571.07V170.073H1586.45V154.666Z" fill="#2A2859"/>
        <path d="M1561.84 154.666H1546.45V170.073H1561.84V154.666Z" fill="#2A2859"/>
        <path d="M1537.22 154.666H1521.84V170.073H1537.22V154.666Z" fill="#2A2859"/>
        <path d="M1537.22 99.1976H1521.84V123.849H1537.22V99.1976Z" fill="#2A2859"/>
        <path d="M1561.84 99.1976H1546.45V123.849H1561.84V99.1976Z" fill="#2A2859"/>
        <path d="M1586.45 99.1976H1571.07V123.849H1586.45V99.1976Z" fill="#2A2859"/>
        <path d="M1611.07 99.1976H1595.69V123.849H1611.07V99.1976Z" fill="#2A2859"/>
        <path d="M1563.37 74.5471C1577.82 74.5471 1589.53 62.8204 1589.53 48.3549C1589.53 33.8893 1577.82 22.1627 1563.37 22.1627C1548.93 22.1627 1537.22 33.8893 1537.22 48.3549C1537.22 62.8204 1548.93 74.5471 1563.37 74.5471Z" fill="#2A2859"/>
        <path d="M1564.91 34.4882H1558.76V40.651H1564.91V34.4882Z" fill="#F8F0DD"/>
        <path d="M1564.91 40.6516H1558.76V46.8145H1564.91V40.6516Z" fill="#F8F0DD"/>
        <path d="M1564.91 46.814H1558.76V52.9767H1564.91V46.814Z" fill="#F8F0DD"/>
        <path d="M1571.07 46.814H1564.91V52.9767H1571.07V46.814Z" fill="#F8F0DD"/>
        <path d="M504.642 259.558L535.413 290.372V352.001H473.872V290.372L504.642 259.558Z" fill="#D0BFAE"/>
        <path d="M566.182 290.372V321.186H596.953V352H566.182H554.797H535.411V332.957V321.186V290.372H566.182Z" fill="#F8F0DD"/>
        <path d="M443.099 321.186H473.87V352H443.099V321.186Z" fill="#F8F0DD"/>
        <path d="M412.33 290.372L443.101 321.186V352H412.33H381.559V321.186L412.33 290.372Z" fill="#D0BFAE"/>
        <path d="M350.783 302.697H381.554V352H350.783V302.697Z" fill="#F8F0DD"/>
        <path d="M320.018 271.883L350.789 302.697V352H320.018H289.248V302.697L320.018 271.883Z" fill="#D0BFAE"/>
        <path d="M535.411 290.372H566.182L535.411 259.558H504.64L535.411 290.372Z" fill="#2A2859"/>
        <path d="M596.953 321.186H566.182V290.372L596.953 321.186Z" fill="#2A2859"/>
        <path d="M495.408 339.674H507.716V351.999H495.408V339.674Z" fill="#2A2859"/>
        <path d="M443.099 321.186H473.87L443.099 290.372H412.328L443.099 321.186Z" fill="#2A2859"/>
        <path d="M406.174 339.674H418.482V351.999H406.174V339.674Z" fill="#2A2859"/>
        <path d="M350.783 302.697H381.554L350.783 271.883H320.013L350.783 302.697Z" fill="#2A2859"/>
        <path d="M313.862 339.674H326.17V351.999H313.862V339.674Z" fill="#2A2859"/>
        {/* Enebolig windows - matching EneboligSvg design */}
        <rect x="316.046" y="302.703" width="8.863" height="8.93" fill="#2A2859"/>
        <rect x="361.73" y="319.003" width="8.863" height="17.92" fill="#2A2859"/>
        <path d="M61.5357 247.23H116.923L86.1525 216.416H30.7648L61.5357 247.23Z" fill="#2A2859"/>
        <path d="M61.5358 247.229H116.923V351.998H61.5358V247.229Z" fill="#F8F0DD"/>
        <path d="M30.7689 216.416L61.5399 247.23V351.999H30.7689H-0.00210571V247.23L30.7689 216.416Z" fill="#D0BFAE"/>
        <path d="M24.6126 339.674H36.921V352H24.6126V339.674Z" fill="#2A2859"/>
        <path d="M36.922 318.105H49.2304V330.431H36.922V318.105Z" fill="#2A2859"/>
        <path d="M12.3031 318.105H24.6115V330.431H12.3031V318.105Z" fill="#2A2859"/>
        <path d="M36.922 293.454H49.2304V305.779H36.922V293.454Z" fill="#2A2859"/>
        <path d="M12.3031 293.454H24.6115V305.779H12.3031V293.454Z" fill="#2A2859"/>
        <path d="M36.922 268.799H49.2304V281.125H36.922V268.799Z" fill="#2A2859"/>
        <path d="M12.3031 268.799H24.6115V281.125H12.3031V268.799Z" fill="#2A2859"/>
        <path d="M83.078 305.779H95.3864V330.431H83.078V305.779Z" fill="#2A2859"/>
        <path d="M83.078 268.799H95.3864V293.45H83.078V268.799Z" fill="#2A2859"/>
        <path d="M190.775 173.276H252.317V351.999H190.775V173.276Z" fill="#F8F0DD"/>
        <path d="M116.927 173.276H190.777V351.999H116.927V173.276Z" fill="#D0BFAE"/>
        <path d="M147.696 339.674H160.005V352H147.696V339.674Z" fill="#2A2859"/>
        <path d="M160.002 293.454H172.311V305.779H160.002V293.454Z" fill="#2A2859"/>
        <path d="M135.387 293.454H147.695V305.779H135.387V293.454Z" fill="#2A2859"/>
        <path d="M160.002 268.799H172.311V281.125H160.002V268.799Z" fill="#2A2859"/>
        <path d="M135.387 268.799H147.695V281.125H135.387V268.799Z" fill="#2A2859"/>
        <path d="M160.002 244.148H172.311V256.474H160.002V244.148Z" fill="#2A2859"/>
        <path d="M135.387 244.148H147.695V256.474H135.387V244.148Z" fill="#2A2859"/>
        <path d="M160.002 219.497H172.311V231.822H160.002V219.497Z" fill="#2A2859"/>
        <path d="M135.387 219.497H147.695V231.822H135.387V219.497Z" fill="#2A2859"/>
        <path d="M160.002 194.845H172.311V207.171H160.002V194.845Z" fill="#2A2859"/>
        <path d="M135.387 194.845H147.695V207.171H135.387V194.845Z" fill="#2A2859"/>
        <path d="M215.393 305.779H227.701V330.431H215.393V305.779Z" fill="#2A2859"/>
        <path d="M215.393 268.799H227.701V293.45H215.393V268.799Z" fill="#2A2859"/>
        <path d="M215.393 231.822H227.701V256.474H215.393V231.822Z" fill="#2A2859"/>
        <path d="M215.393 194.845H227.701V219.497H215.393V194.845Z" fill="#2A2859"/>
        <path d="M646.185 197.928V185.602H658.493V173.276H670.802V185.602H683.11V197.928H695.419V351.999H633.877V197.928H646.185Z" fill="#D0BFAE"/>
        <path d="M683.111 173.276H685.45H695.42V185.602H697.174H707.728V197.928H697.174H695.42H683.111V185.602H670.803V173.276H683.111Z" fill="#2A2859"/>
        <path d="M809.271 259.555V321.183V351.998H778.5V321.183V259.555H809.271Z" fill="#F8F0DD"/>
        <path d="M747.728 228.741L778.499 259.555V351.998H716.958V259.555L747.728 228.741Z" fill="#D0BFAE"/>
        <path d="M778.5 259.555H809.271L778.5 228.741H747.729L778.5 259.555Z" fill="#2A2859"/>
        <path d="M738.498 339.674H750.806V352H738.498V339.674Z" fill="#2A2859"/>
        <path d="M753.881 268.799H766.19V281.125H753.881V268.799Z" fill="#2A2859"/>
        <path d="M729.27 268.799H741.578V281.125H729.27V268.799Z" fill="#2A2859"/>
        <path d="M753.881 293.454H766.19V305.779H753.881V293.454Z" fill="#2A2859"/>
        <path d="M729.27 293.454H741.578V305.779H729.27V293.454Z" fill="#2A2859"/>
        <path d="M658.495 339.674H670.803V352H658.495V339.674Z" fill="#2A2859"/>
        <path d="M646.186 315.023H658.494V327.349H646.186V315.023Z" fill="#2A2859"/>
        <path d="M670.804 315.023H683.113V327.349H670.804V315.023Z" fill="#2A2859"/>
        <path d="M646.186 302.698H658.494V315.023H646.186V302.698Z" fill="#2A2859"/>
        <path d="M670.804 302.698H683.113V315.023H670.804V302.698Z" fill="#2A2859"/>
        <path d="M646.186 278.043H658.494V290.369H646.186V278.043Z" fill="#2A2859"/>
        <path d="M670.804 278.043H683.113V290.369H670.804V278.043Z" fill="#2A2859"/>
        <path d="M646.186 265.718H658.494V278.043H646.186V265.718Z" fill="#2A2859"/>
        <path d="M670.804 265.718H683.113V278.043H670.804V265.718Z" fill="#2A2859"/>
        <path d="M646.186 241.067H658.494V253.392H646.186V241.067Z" fill="#2A2859"/>
        <path d="M670.804 241.067H683.113V253.392H670.804V241.067Z" fill="#2A2859"/>
        <path d="M695.419 197.927H716.959V351.999H695.419V197.927Z" fill="#2A2859"/>
        <path d="M664.649 228.741C656.152 228.741 649.264 221.843 649.264 213.334C649.264 204.825 656.152 197.927 664.649 197.927C673.146 197.927 680.034 204.825 680.034 213.334C680.034 221.843 673.146 228.741 664.649 228.741Z" fill="#2A2859"/>
        <path d="M897.769 290.371V197.928L866.998 167.114L836.227 197.928V352H875.737H897.769H1020.85V290.371H897.769Z" fill="#F8F0DD"/>
        <path d="M1020.85 250.311V290.37H959.31H942.078H897.768V250.311H1020.85Z" fill="#2A2859"/>
        <path d="M873.151 327.349H860.843V352.001H873.151V327.349Z" fill="#2A2859"/>
        <path d="M947.005 315.024H934.696V327.35H947.005V315.024Z" fill="#2A2859"/>
        <path d="M922.389 315.024H910.081V327.35H922.389V315.024Z" fill="#2A2859"/>
        <path d="M947.005 302.698H934.696V315.024H947.005V302.698Z" fill="#2A2859"/>
        <path d="M922.389 302.698H910.081V315.024H922.389V302.698Z" fill="#2A2859"/>
        <path d="M996.235 315.024H983.927V327.35H996.235V315.024Z" fill="#2A2859"/>
        <path d="M971.62 315.024H959.312V327.35H971.62V315.024Z" fill="#2A2859"/>
        <path d="M996.235 302.698H983.927V315.024H996.235V302.698Z" fill="#2A2859"/>
        <path d="M971.62 302.698H959.312V315.024H971.62V302.698Z" fill="#2A2859"/>
        <path d="M866.997 231.823C875.494 231.823 882.383 224.925 882.383 216.416C882.383 207.907 875.494 201.009 866.997 201.009C858.5 201.009 851.612 207.907 851.612 216.416C851.612 224.925 858.5 231.823 866.997 231.823Z" fill="#2A2859"/>
      </g>

      {/* Enebolig clone that stays visible when pinEnebolig is true */}
      {/* Uses same design as EneboligSvg from BuildingSprites.tsx, transformed to skyline coordinates */}
      <g
        id="landing-enebolig"
        transform="translate(289.248, 271.003) scale(0.9925, 1)"
        style={{
          opacity: pinEnebolig ? 1 : 0,
          transition: 'opacity 1.5s ease-in-out',
          pointerEvents: 'none',
        }}
      >
        {/* Right side wall */}
        <rect x="62" y="31.7" width="31" height="49.3" fill="#F8F0DD" />
        {/* Main house body */}
        <polygon points="31 0.88 0 31.7 0 81 62 81 62 31.7 31 0.88" fill="#D0BFAE" />
        {/* Roof */}
        <polygon points="62 31.7 93 31.7 62 0.88 31 0.88 62 31.7" fill="#2A2859" />
        {/* Door */}
        <rect x="24.78" y="68.67" width="12.44" height="12.33" fill="#2A2859" />
        {/* Left window */}
        <rect x="27" y="31.7" width="8.93" height="8.93" fill="#2A2859" />
        {/* Right window */}
        <rect x="73.03" y="48" width="8.93" height="17.92" fill="#2A2859" />
      </g>
      
      {/* Blokk building - uses invisible bounding rect to match BlokkSvg viewBox dimensions */}
      {/* The invisible rect extends getBoundingClientRect() to include full viewBox area (0,0 to 136,204) */}
      {/* This ensures the captured rect matches what TransitionOverlayRenderer renders with BlokkSvg */}
      <g
        id="landing-blokk"
        transform="translate(1051, 153.149)"
        style={{
          opacity: pinBlock === undefined ? (hideBlockAnimation ? fadeOpacity : 1) : pinBlock ? 1 : 0,
          transition: blockTransition,
          pointerEvents: 'none',
        }}
      >
        {/* Invisible bounding rect - extends bounding box to match BlokkSvg viewBox (0 0 136 204) */}
        {/* Using near-zero opacity to ensure rect is included in getBoundingClientRect() */}
        <rect x="0" y="0" width="136" height="204" fill="#000000" fillOpacity="0.001" />
        {/* Roof structure - matches BlokkSvg */}
        <path d="M120.744,41.319v-12.023h-12.1v-12.023h-12.544c-3.42-3.489-6.839-6.979-10.259-10.468h-35.318c3.65,3.65,7.299,7.299,10.949,10.949h12.269v11.542h12.1v12.023h11.434v12.023h34.902v-12.023h-11.434Z" fill="#2A2859"/>
        {/* Right side wall */}
        <rect x="97.276" y="53.342" width="34.902" height="145.509" fill="#F8F0DD" />
        {/* Main building body */}
        <polygon points="85.842 41.319 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.217 29.296 15.217 41.319 3.783 41.319 3.783 53.342 3.783 198.851 97.276 198.851 97.276 53.342 97.276 41.319 85.842 41.319" fill="#D0BFAE" />
        {/* Door */}
        <rect x="44.967" y="187.725" width="11.126" height="11.126" fill="#2A2859" />
        {/* Windows - row 1 (top) */}
        <rect x="21.775" y="65.034" width="11.126" height="11.126" fill="#2A2859" />
        <rect x="44.967" y="65.034" width="11.126" height="11.126" fill="#2A2859" />
        <rect x="68.158" y="65.034" width="11.126" height="11.126" fill="#2A2859" />
        {/* Windows - row 2 (middle) */}
        <rect x="21.775" y="88.439" width="11.126" height="11.126" fill="#2A2859" />
        <rect x="44.967" y="88.439" width="11.126" height="11.126" fill="#2A2859" />
        <rect x="68.158" y="88.439" width="11.126" height="11.126" fill="#2A2859" />
        {/* Windows - row 3 (bottom) */}
        <rect x="21.775" y="111.844" width="11.126" height="11.126" fill="#2A2859" />
        <rect x="44.967" y="111.844" width="11.126" height="11.126" fill="#2A2859" />
        <rect x="68.158" y="111.844" width="11.126" height="11.126" fill="#2A2859" />
      </g>
    </svg>
  );
};
