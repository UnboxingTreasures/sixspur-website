'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getIdToken } from '@/lib/cognito'
import { useCart } from '@/context/CartContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('sixspur_isAdmin') === 'true'
  })

  const { cartCount } = useCart()
  const pathname = usePathname()

  useEffect(() => {
    getIdToken().then(async (token) => {
      setIsLoggedIn(Boolean(token))
      if (!token) {
        window.localStorage.removeItem('sixspur_isAdmin')
        setIsAdmin(false)
        return
      }
      try {
        const res = await fetch(`${API_URL}/donor/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        const confirmedIsAdmin = Boolean(data.isAdmin)
        setIsAdmin(confirmedIsAdmin)
        window.localStorage.setItem('sixspur_isAdmin', String(confirmedIsAdmin))
      } catch (err) {
        console.error('Failed to check admin status:', err)
      }
    })
  }, [pathname])

  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .nav-desktop-links { display: none !important; }
          .nav-mobile-toggle { display: flex !important; align-items: center; }
        }
        @media (max-width: 480px) {
          .nav-row { padding: 0 1rem !important; gap: 0.5rem !important; }
          .nav-icons { gap: 10px !important; }
          .nav-logo-text { display: none !important; }
        }
      `}</style>
      <nav style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E2DC', position: 'relative', zIndex: 50, overflow: 'hidden' }}>
        <div className="nav-row" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

          <Link href='/' style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', minWidth: 0, flexShrink: 1 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 928 1130" style={{ width: '36px', height: '44px', flexShrink: 0 }}>
              <g fill="#111111">
                <path fillRule="evenodd" d="M162.51 1083.22C158.96 1086.25 155 1084.85 155 1080.55C155 1077.26 161.83 1042.84 167.62 1017C170.64 1003.54 171.18 999.31 170.84 991.82C170.53 984.95 170.18 983.8 167.63 981.13C166.05 979.49 162.46 977.13 159.63 975.9C150.42 971.87 127.68 972.13 96 976.62C83.93 978.33 57.13 983.62 53.47 985.01C49.19 986.64 44.51 983.74 45.74 980.22C46.21 978.87 58.35 970.41 63.5 967.84C65.15 967.02 71.3 963.57 77.17 960.17C83.03 956.78 88.32 954 88.92 954C89.51 954 90 953.16 90 952.12C90 950.81 92.16 949.13 97.25 946.49C117.92 935.76 135.46 923.9 144.75 914.38C149.52 909.49 150 908.58 150 904.47C150 895.48 143.81 887.8 119 866.03C108.01 856.38 88.78 836.82 86.97 833.44C84.87 829.53 86.37 827.73 91.26 828.29C96.86 828.94 99.38 829.69 119.94 836.89C129.53 840.25 137.64 843.42 137.96 843.94C139.81 846.92 166.38 853.98 175.81 853.99C181.89 854 182.27 853.85 186.43 849.75C195.93 840.38 199.76 823.99 204.03 774.5C204.7 766.8 205.65 758.84 206.14 756.81C207.08 752.99 209.38 751.44 212.41 752.6C214.21 753.29 219.65 760.96 224.78 770.04C228.81 777.18 244.32 810.42 246.02 815.55C247.89 821.22 252.42 828.19 255.9 830.77C260.07 833.85 264.24 833.72 278.74 830.06C285.05 828.47 299.54 821.53 304.31 817.81C309.32 813.9 328.17 797.68 336.31 790.28C342.21 784.92 345.7 783.73 347.88 786.36C348.75 787.41 347.25 792.55 341.38 808.61C330.14 839.37 326.4 852.93 324.52 869.75C324.03 874.13 324.2 875 325.52 875C326.86 875 346.36 865.24 349.5 863C350.05 862.61 351.85 861.81 353.5 861.22C355.15 860.63 359.2 859.16 362.5 857.95C373.27 853.98 383.37 851.63 398.9 849.45C416.83 846.93 451.57 847.89 468 851.35C490.73 856.13 500.89 858.78 518.5 864.5C526.9 867.23 546.31 872.01 555 873.5C578.49 877.53 589.65 878.37 620 878.44C648.49 878.5 661.64 877.86 669 876.04C670.92 875.57 674.97 874.65 678 874C689.85 871.47 700.92 867.6 710.22 862.76C720.01 857.67 731.22 849.16 734 844.72C734.83 843.4 736.82 840.33 738.42 837.91C746.12 826.3 749.66 815.44 750.68 800.33C751.39 789.63 750 781.02 746.28 773.13C741.05 762.06 725.81 749.1 707.93 740.53C704.07 738.68 700.37 736.74 699.7 736.21C697.74 734.65 683.96 730.2 666.5 725.5C661 724.02 655.6 722.44 654.5 722C653.4 721.56 648.67 720.2 644 718.99C639.33 717.78 633.47 716.17 631 715.42C628.53 714.67 619.97 712.44 612 710.47C604.03 708.5 596.38 706.52 595 706.06C593.62 705.6 590.7 704.73 588.5 704.13C577.03 700.95 537.34 688.15 532.5 686.06C531.4 685.59 528.92 684.63 527 683.93C520.2 681.46 500.48 670.76 491.55 664.68C486.19 661.04 477.4 653.43 469.98 646.01C457.49 633.53 456.99 632.83 448.13 615.5C445.29 609.95 441.34 596.64 440.48 589.74C440.09 586.57 439.37 583.73 438.88 583.43C438.4 583.13 433.84 584.32 428.75 586.08C419.87 589.15 416.91 589.96 407 592.06C397.3 594.12 389.96 595.1 377 596.05C361.9 597.16 333.41 596.55 325 594.94C321.98 594.36 317.02 593.42 314 592.86C284.38 587.35 259.7 576.4 240.03 560.05C230.01 551.72 228.82 550.55 221.06 541.5C211.61 530.46 209.1 526.74 200.81 511.5C190.45 492.44 182.47 470.8 178.51 451C177.58 446.33 176.18 439.35 175.4 435.5C170.79 412.64 167.83 361.25 169.23 328.5C170.51 298.45 172.22 284.36 176.96 264.52C178.63 257.52 180 250.91 180 249.85C180 245.67 188.76 220.64 194.58 208.2C196.46 204.18 198 200.26 198 199.48C198 197.53 208.14 180.08 214.56 171C220.38 162.75 238.37 142.93 247 135.25C265.89 118.44 289.56 106 315 99.53C318.58 98.62 323.08 97.47 325 96.99C332.55 95.08 339.73 94.75 372.5 94.82C408.7 94.9 421.65 95.94 435 99.86C436.92 100.43 440.19 101.36 442.25 101.94C444.31 102.52 447.46 103.42 449.25 103.93C458.78 106.66 480.4 115.32 491.15 120.71C500.05 125.17 502.85 127.85 506.86 135.71C509.8 141.49 509.87 153.38 506.99 159.01C499.09 174.51 484.04 179.04 465.12 171.62C449.47 165.47 442.48 163 440.79 163C439.87 163 438.84 162.55 438.5 162C438.16 161.45 436.8 161 435.49 161C434.17 161 432.06 160.59 430.8 160.1C424.77 157.72 407.58 155.23 389 154.05C345.86 151.3 311.1 160.38 287.13 180.67C280.07 186.64 270 197.76 270 199.57C270 200.32 267.94 204.12 265.42 208.01C253.43 226.55 240.25 258.08 235.95 278.5C235.49 280.7 234.63 284.52 234.04 287C231.98 295.69 229.89 312.29 230.74 313.14C231.84 314.24 241.31 308.31 240.52 307.02C239.77 305.82 245.67 302.05 258.71 295.39C292.88 277.95 326.46 271.23 374 272.31C399.6 272.89 404.42 273.49 427.32 279.03C432.72 280.33 459.83 293.76 467.5 298.93C473.9 303.24 477.06 306.09 476.48 307.03C476.23 307.44 477.93 309.34 480.26 311.25C489.07 318.47 496.84 327.15 504.45 338.27C509.63 345.84 517.25 359.86 519.52 366C520.44 368.48 521.55 371.4 521.99 372.5C524.12 377.78 525.68 383.69 528.86 398.5C530.51 406.18 532 418.55 532 424.6C532 428.61 532.41 430.22 533.55 430.66C534.41 430.99 540.82 429.43 547.8 427.2C563 422.35 563.24 422.3 590.5 418.02C606.18 415.56 659.31 416.08 685.93 418.95C702.28 420.72 722.12 424.31 736.5 428.11C738.7 428.69 742.3 429.63 744.5 430.2C746.7 430.77 749.62 431.58 751 432C752.38 432.42 755.53 433.32 758 434C760.47 434.67 763.4 435.61 764.5 436.07C765.6 436.54 768.37 437.39 770.66 437.97C777.34 439.67 786.96 446.88 790.13 452.58C792.52 456.87 792.88 458.64 792.93 466.37C793.02 477.79 791 483.79 785.05 489.77C776.83 498.03 766.2 500.19 755 495.88C748.24 493.28 739.04 490.51 728.5 487.91C724.1 486.83 718.92 485.53 717 485.03C715.08 484.53 710.58 483.61 707 482.99C703.42 482.36 697.35 481.25 693.5 480.52C676.86 477.35 664.89 476.5 637 476.52C618.68 476.53 605.82 476.99 601 477.81C555.99 485.42 527.52 500.97 514.13 525.25C509.37 533.89 508.46 536.4 506.42 546.5C503.71 559.9 505.38 574.66 510.97 586.71C516.65 598.93 533.96 613.61 553.06 622.38C557.7 624.51 562.17 626.65 563 627.14C563.83 627.62 565.17 628.28 566 628.6C566.83 628.92 568.4 629.57 569.5 630.05C571.41 630.87 579.08 633.25 585.5 635.01C587.15 635.46 591.2 636.57 594.5 637.49C602.91 639.82 618.78 644.02 623.25 645.09C632.49 647.33 634.71 647.84 638 648.48C639.92 648.85 642.4 649.54 643.5 650.01C644.6 650.48 646.85 651.07 648.5 651.33C652.89 652.02 673.96 657.51 683.9 660.55C688.63 662 697 664.54 702.5 666.2C708 667.85 713.4 669.57 714.5 670.01C715.6 670.45 719.2 671.79 722.5 673C739.3 679.15 753.75 686.57 765 694.82C774.68 701.91 790.01 716.84 795.5 724.5C801.79 733.29 811.9 756.65 811.98 762.55C811.99 763.68 812.41 765.03 812.91 765.55C815.22 767.97 816.73 804.11 815.01 816C811.43 840.75 803.79 858.42 788.35 877.62C768.07 902.84 738.31 920.56 697 932.01C692.68 933.21 685.26 934.61 673.5 936.44C633.82 942.62 586.97 940.89 556 932.12C550.22 930.48 537.17 926.86 527 924.07C516.83 921.28 502.88 917.42 496 915.48C489.12 913.55 481.48 911.57 479 911.08C476.52 910.6 470.67 909.41 466 908.43C450.72 905.25 415.36 906.06 398.5 909.98C396.3 910.49 391.35 911.63 387.5 912.52C383.65 913.4 377.87 915.01 374.67 916.09C371.46 917.17 367.18 918.21 365.17 918.41C360.15 918.89 344.93 925.02 344.23 926.84C343.89 927.73 344.83 929.28 346.58 930.72C360.03 941.8 366.03 946.46 369.25 948.33C371.39 949.57 372.79 951.05 372.52 951.79C372.25 952.5 372.81 953.36 373.77 953.71C374.72 954.05 380 957.3 385.5 960.92C391 964.54 395.95 967.72 396.5 968C401.94 970.72 406.91 975.53 406.97 978.13C407.05 982.2 405.71 982.3 368.4 980.98C348.82 980.29 329.45 980.01 325.36 980.35C310.64 981.6 302.7 987.56 299.43 999.8C297.86 1005.7 297.67 1010.47 297.89 1039.68C298.12 1069.38 297.97 1073.12 296.46 1075.43C295.53 1076.84 294.16 1078 293.42 1078C290.19 1078 277 1063.55 277 1060.01C277 1058.34 275.45 1055.84 266.07 1042.41C260.89 1034.98 247.7 1019.84 241.42 1014.1C236.02 1009.17 235.65 1009 229.9 1009C225.21 1009 223.08 1009.55 219.81 1011.62C215.31 1014.46 206.71 1022.93 204.12 1027.08C203.23 1028.5 200.35 1032.55 197.72 1036.08C184.72 1053.52 181 1058.8 181 1059.82C181 1061.08 165.58 1080.59 162.51 1083.22ZM345 537.05C348.13 538.11 373.62 537.46 381 536.13C400.18 532.69 413.14 527.77 423.13 520.13C426.08 517.88 430.7 514.34 433.39 512.27C442.17 505.5 452.38 493.13 457.4 483.17C469.67 458.85 472.02 432.96 464.83 401.5C461.99 389.09 460.33 384.64 455.39 376.28C450.44 367.89 450.38 367.81 442.5 359.25C430.96 346.73 415.55 337.81 398.5 333.8C386.87 331.06 381.75 330.63 361.5 330.63C335.75 330.63 322.56 331.59 320.55 333.59C319.78 334.37 318.32 335.01 317.32 335.03C311.86 335.1 291.98 343.46 281.39 350.13C260.93 363.02 245.8 381.37 240 400.33C237.51 408.45 235.72 422.5 236.24 429.72C236.47 432.9 238.07 440.07 239.81 445.66C249.43 476.64 264.22 498.73 286.5 515.4C299.02 524.78 309.16 529.93 320 532.45C324.12 533.4 328.88 534.59 330.57 535.09C332.26 535.59 335.64 536.04 338.07 536.1C340.51 536.15 343.62 536.58 345 537.05ZM227.98 945.52C230.87 946.45 235.57 946.87 241.02 946.69C248.09 946.45 250.66 945.88 256.2 943.29C275.67 934.18 283.31 915.33 272.73 902.49C267.83 896.55 261.24 894.02 250.57 894.01C242.2 894 241.13 894.25 233.44 897.97C220.24 904.36 212.95 914.34 213.02 925.93C213.07 933.95 219.93 942.94 227.98 945.52Z"/>
              </g>
            </svg>
            <div className="nav-logo-text" style={{ lineHeight: '1.25', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ color: '#111111', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Six Spur Ranch and Rescue</div>
              <div style={{ color: '#555555', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Maud, Texas · 501(c)(3)</div>
            </div>
          </Link>

          <div className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link href='/'            style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Home</Link>
            <Link href='/ways-to-give'      style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Donate</Link>
            <Link href='/adopt'       style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Adopt</Link>
            <Link href='/shop'        style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Shop</Link>
            <Link href='/about'       style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>About</Link>
            <Link href='/contact'     style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Contact</Link>
          </div>

          <div className="nav-icons" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <Link href={isLoggedIn ? '/account' : '/account/login'} aria-label={isLoggedIn ? 'My Account' : 'Log In'} style={{ color: '#111111', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>

            {isAdmin && (
              <Link href='/admin' aria-label='Admin Panel' style={{ color: '#111111', display: 'flex', alignItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 4 5v6c0 5.25 3.44 9.74 8 11 4.56-1.26 8-5.75 8-11V5l-8-3z"/>
                </svg>
              </Link>
            )}

            <Link href='/cart' aria-label='Cart' style={{ position: 'relative', color: '#111111', display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              {cartCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#E77A2D', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '999px', minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'none', border: 'none', color: '#555555', fontSize: '20px', cursor: 'pointer', display: 'none' }}
            aria-label='Toggle menu'
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div style={{ background: '#FFFFFF', borderTop: '1px solid #E8E2DC', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 49 }}>
          <Link href='/'            style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Home</Link>
          <Link href='/ways-to-give'      style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Donate</Link>
          <Link href='/adopt'       style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Adopt</Link>
          <Link href='/shop'        style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Shop</Link>
          <Link href='/about'       style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>About</Link>
          <Link href='/contact'     style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>Contact</Link>
          <div style={{ display: 'flex', gap: '16px', paddingTop: '4px', flexWrap: 'wrap' }}>
            <Link href={isLoggedIn ? '/account' : '/account/login'} style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setMobileOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {isLoggedIn ? 'My Account' : 'Log In'}
            </Link>
            {isAdmin && (
              <Link href='/admin' style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setMobileOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 4 5v6c0 5.25 3.44 9.74 8 11 4.56-1.26 8-5.75 8-11V5l-8-3z"/>
                </svg>
                Admin Panel
              </Link>
            )}
            <Link href='/cart' style={{ color: '#111111', fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setMobileOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              Cart{cartCount > 0 ? ` (${cartCount})` : ''}
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
