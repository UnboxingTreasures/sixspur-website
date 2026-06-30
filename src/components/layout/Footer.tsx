'use client';

import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ background: '#FFFFFF', color: '#111111', borderTop: '1px solid #E8E2DC' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Top grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '2rem', paddingBottom: '2rem', borderBottom: '0.5px solid #E8E2DC' }}>

          {/* Brand */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 928 1130" style={{ width: '28px', height: '34px', flexShrink: 0, display: 'block' }}>
              <g fill="#111111">
                <path d="M 162.51 1083.22 C158.96,1086.25 155.00,1084.85 155.00,1080.55 C155.00,1077.26 161.83,1042.84 167.62,1017.00 C170.64,1003.54 171.18,999.31 170.84,991.82 C170.53,984.95 170.18,983.80 167.63,981.13 C166.05,979.49 162.46,977.13 159.63,975.90 C150.42,971.87 127.68,972.13 96.00,976.62 C83.93,978.33 57.13,983.62 53.47,985.01 C49.19,986.64 44.51,983.74 45.74,980.22 C46.21,978.87 58.35,970.41 63.50,967.84 C65.15,967.02 71.30,963.57 77.17,960.17 C83.03,956.78 88.32,954.00 88.92,954.00 C89.51,954.00 90.00,953.16 90.00,952.12 C90.00,950.81 92.16,949.13 97.25,946.49 C117.92,935.76 135.46,923.90 144.75,914.38 C149.52,909.49 150.00,908.58 150.00,904.47 C150.00,895.48 143.81,887.80 119.00,866.03 C108.01,856.38 88.78,836.82 86.97,833.44 C84.87,829.53 86.37,827.73 91.26,828.29 C96.86,828.94 99.38,829.69 119.94,836.89 C129.53,840.25 137.64,843.42 137.96,843.94 C139.81,846.92 166.38,853.98 175.81,853.99 C181.89,854.00 182.27,853.85 186.43,849.75 C195.93,840.38 199.76,823.99 204.03,774.50 C204.70,766.80 205.65,758.84 206.14,756.81 C207.08,752.99 209.38,751.44 212.41,752.60 C214.21,753.29 219.65,760.96 224.78,770.04 C228.81,777.18 244.32,810.42 246.02,815.55 C247.89,821.22 252.42,828.19 255.90,830.77 C260.07,833.85 264.24,833.72 278.74,830.06 C285.05,828.47 299.54,821.53 304.31,817.81 C309.32,813.90 328.17,797.68 336.31,790.28 C342.21,784.92 345.70,783.73 347.88,786.36 C348.75,787.41 347.25,792.55 341.38,808.61 C330.14,839.37 326.40,852.93 324.52,869.75 C324.03,874.13 324.20,875.00 325.52,875.00 C326.86,875.00 346.36,865.24 349.50,863.00 C350.05,862.61 351.85,861.81 353.50,861.22 C355.15,860.63 359.20,859.16 362.50,857.95 C373.27,853.98 383.37,851.63 398.90,849.45 C416.83,846.93 451.57,847.89 468.00,851.35 C490.73,856.13 500.89,858.78 518.50,864.50 C526.90,867.23 546.31,872.01 555.00,873.50 C578.49,877.53 589.65,878.37 620.00,878.44 C648.49,878.50 661.64,877.86 669.00,876.04 C670.92,875.57 674.97,874.65 678.00,874.00 C689.85,871.47 700.92,867.60 710.22,862.76 C720.01,857.67 731.22,849.16 734.00,844.72 C734.83,843.40 736.82,840.33 738.42,837.91 C746.12,826.30 749.66,815.44 750.68,800.33 C751.39,789.63 750.00,781.02 746.28,773.13 C741.05,762.06 725.81,749.10 707.93,740.53 C704.07,738.68 700.37,736.74 699.70,736.21 C697.74,734.65 683.96,730.20 666.50,725.50 C661.00,724.02 655.60,722.44 654.50,722.00 C653.40,721.56 648.67,720.20 644.00,718.99 C639.33,717.78 633.47,716.17 631.00,715.42 C628.53,714.67 619.97,712.44 612.00,710.47 C604.03,708.50 596.38,706.52 595.00,706.06 C593.62,705.60 590.70,704.73 588.50,704.13 C577.03,700.95 537.34,688.15 532.50,686.06 C531.40,685.59 528.92,684.63 527.00,683.93 C520.20,681.46 500.48,670.76 491.55,664.68 C486.19,661.04 477.40,653.43 469.98,646.01 C457.49,633.53 456.99,632.83 448.13,615.50 C445.29,609.95 441.34,596.64 440.48,589.74 C440.09,586.57 439.37,583.73 438.88,583.43 C438.40,583.13 433.84,584.32 428.75,586.08 C419.87,589.15 416.91,589.96 407.00,592.06 C397.30,594.12 389.96,595.10 377.00,596.05 C361.90,597.16 333.41,596.55 325.00,594.94 C321.98,594.36 317.02,593.42 314.00,592.86 C284.38,587.35 259.70,576.40 240.03,560.05 C230.01,551.72 228.82,550.55 221.06,541.50 C211.61,530.46 209.10,526.74 200.81,511.50 C190.45,492.44 182.47,470.80 178.51,451.00 C177.58,446.33 176.18,439.35 175.40,435.50 C170.79,412.64 167.83,361.25 169.23,328.50 C170.51,298.45 172.22,284.36 176.96,264.52 C178.63,257.52 180.00,250.91 180.00,249.85 C180.00,245.67 188.76,220.64 194.58,208.20 C196.46,204.18 198.00,200.26 198.00,199.48 C198.00,197.53 208.14,180.08 214.56,171.00 C220.38,162.75 238.37,142.93 247.00,135.25 C265.89,118.44 289.56,106.00 315.00,99.53 C318.58,98.62 323.08,97.47 325.00,96.99 C332.55,95.08 339.73,94.75 372.50,94.82 C408.70,94.90 421.65,95.94 435.00,99.86 C436.92,100.43 440.19,101.36 442.25,101.94 C444.31,102.52 447.46,103.42 449.25,103.93 C458.78,106.66 480.40,115.32 491.15,120.71 C500.05,125.17 502.85,127.85 506.86,135.71 C509.80,141.49 509.87,153.38 506.99,159.01 C499.09,174.51 484.04,179.04 465.12,171.62 C449.47,165.47 442.48,163.00 440.79,163.00 C439.87,163.00 438.84,162.55 438.50,162.00 C438.16,161.45 436.80,161.00 435.49,161.00 C434.17,161.00 432.06,160.59 430.80,160.10 C424.77,157.72 407.58,155.23 389.00,154.05 C345.86,151.30 311.10,160.38 287.13,180.67 C280.07,186.64 270.00,197.76 270.00,199.57 C270.00,200.32 267.94,204.12 265.42,208.01 C253.43,226.55 240.25,258.08 235.95,278.50 C235.49,280.70 234.63,284.52 234.04,287.00 C231.98,295.69 229.89,312.29 230.74,313.14 C231.84,314.24 241.31,308.31 240.52,307.02 C239.77,305.82 245.67,302.05 258.71,295.39 C292.88,277.95 326.46,271.23 374.00,272.31 C399.60,272.89 404.42,273.49 427.32,279.03 C432.72,280.33 459.83,293.76 467.50,298.93 C473.90,303.24 477.06,306.09 476.48,307.03 C476.23,307.44 477.93,309.34 480.26,311.25 C489.07,318.47 496.84,327.15 504.45,338.27 C509.63,345.84 517.25,359.86 519.52,366.00 C520.44,368.48 521.55,371.40 521.99,372.50 C524.12,377.78 525.68,383.69 528.86,398.50 C530.51,406.18 532.00,418.55 532.00,424.60 C532.00,428.61 532.41,430.22 533.55,430.66 C534.41,430.99 540.82,429.43 547.80,427.20 C563.00,422.35 563.24,422.30 590.50,418.02 C606.18,415.56 659.31,416.08 685.93,418.95 C702.28,420.72 722.12,424.31 736.50,428.11 C738.70,428.69 742.30,429.63 744.50,430.20 C746.70,430.77 749.62,431.58 751.00,432.00 C752.38,432.42 755.53,433.32 758.00,434.00 C760.47,434.67 763.40,435.61 764.50,436.07 C765.60,436.54 768.37,437.39 770.66,437.97 C777.34,439.67 786.96,446.88 790.13,452.58 C792.52,456.87 792.88,458.64 792.93,466.37 C793.02,477.79 791.00,483.79 785.05,489.77 C776.83,498.03 766.20,500.19 755.00,495.88 C748.24,493.28 739.04,490.51 728.50,487.91 C724.10,486.83 718.92,485.53 717.00,485.03 C715.08,484.53 710.58,483.61 707.00,482.99 C703.42,482.36 697.35,481.25 693.50,480.52 C676.86,477.35 664.89,476.50 637.00,476.52 C618.68,476.53 605.82,476.99 601.00,477.81 C555.99,485.42 527.52,500.97 514.13,525.25 C509.37,533.89 508.46,536.40 506.42,546.50 C503.71,559.90 505.38,574.66 510.97,586.71 C516.65,598.93 533.96,613.61 553.06,622.38 C557.70,624.51 562.17,626.65 563.00,627.14 C563.83,627.62 565.17,628.28 566.00,628.60 C566.83,628.92 568.40,629.57 569.50,630.05 C571.41,630.87 579.08,633.25 585.50,635.01 C587.15,635.46 591.20,636.57 594.50,637.49 C602.91,639.82 618.78,644.02 623.25,645.09 C632.49,647.33 634.71,647.84 638.00,648.48 C639.92,648.85 642.40,649.54 643.50,650.01 C644.60,650.48 646.85,651.07 648.50,651.33 C652.89,652.02 673.96,657.51 683.90,660.55 C688.63,662.00 697.00,664.54 702.50,666.20 C708.00,667.85 713.40,669.57 714.50,670.01 C715.60,670.45 719.20,671.79 722.50,673.00 C739.30,679.15 753.75,686.57 765.00,694.82 C774.68,701.91 790.01,716.84 795.50,724.50 C801.79,733.29 811.90,756.65 811.98,762.55 C811.99,763.68 812.41,765.03 812.91,765.55 C815.22,767.97 816.73,804.11 815.01,816.00 C811.43,840.75 803.79,858.42 788.35,877.62 C768.07,902.84 738.31,920.56 697.00,932.01 C692.68,933.21 685.26,934.61 673.50,936.44 C633.82,942.62 586.97,940.89 556.00,932.12 C550.22,930.48 537.17,926.86 527.00,924.07 C516.83,921.28 502.88,917.42 496.00,915.48 C489.12,913.55 481.48,911.57 479.00,911.08 C476.52,910.60 470.67,909.41 466.00,908.43 C450.72,905.25 415.36,906.06 398.50,909.98 C396.30,910.49 391.35,911.63 387.50,912.52 C383.65,913.40 377.87,915.01 374.67,916.09 C371.46,917.17 367.18,918.21 365.17,918.41 C360.15,918.89 344.93,925.02 344.23,926.84 C343.89,927.73 344.83,929.28 346.58,930.72 C360.03,941.80 366.03,946.46 369.25,948.33 C371.39,949.57 372.79,951.05 372.52,951.79 C372.25,952.50 372.81,953.36 373.77,953.71 C374.72,954.05 380.00,957.30 385.50,960.92 C391.00,964.54 395.95,967.72 396.50,968.00 C401.94,970.72 406.91,975.53 406.97,978.13 C407.05,982.20 405.71,982.30 368.40,980.98 C348.82,980.29 329.45,980.01 325.36,980.35 C310.64,981.60 302.70,987.56 299.43,999.80 C297.86,1005.70 297.67,1010.47 297.89,1039.68 C298.12,1069.38 297.97,1073.12 296.46,1075.43 C295.53,1076.84 294.16,1078.00 293.42,1078.00 C290.19,1078.00 277.00,1063.55 277.00,1060.01 C277.00,1058.34 275.45,1055.84 266.07,1042.41 C260.89,1034.98 247.70,1019.84 241.42,1014.10 C236.02,1009.17 235.65,1009.00 229.90,1009.00 C225.21,1009.00 223.08,1009.55 219.81,1011.62 C215.31,1014.46 206.71,1022.93 204.12,1027.08 C203.23,1028.50 200.35,1032.55 197.72,1036.08 C184.72,1053.52 181.00,1058.80 181.00,1059.82 C181.00,1061.08 165.58,1080.59 162.51,1083.22 ZM 345.00 537.05 C348.13,538.11 373.62,537.46 381.00,536.13 C400.18,532.69 413.14,527.77 423.13,520.13 C426.08,517.88 430.70,514.34 433.39,512.27 C442.17,505.50 452.38,493.13 457.40,483.17 C469.67,458.85 472.02,432.96 464.83,401.50 C461.99,389.09 460.33,384.64 455.39,376.28 C450.44,367.89 450.38,367.81 442.50,359.25 C430.96,346.73 415.55,337.81 398.50,333.80 C386.87,331.06 381.75,330.63 361.50,330.63 C335.75,330.63 322.56,331.59 320.55,333.59 C319.78,334.37 318.32,335.01 317.32,335.03 C311.86,335.10 291.98,343.46 281.39,350.13 C260.93,363.02 245.80,381.37 240.00,400.33 C237.51,408.45 235.72,422.50 236.24,429.72 C236.47,432.90 238.07,440.07 239.81,445.66 C249.43,476.64 264.22,498.73 286.50,515.40 C299.02,524.78 309.16,529.93 320.00,532.45 C324.12,533.40 328.88,534.59 330.57,535.09 C332.26,535.59 335.64,536.04 338.07,536.10 C340.51,536.15 343.62,536.58 345.00,537.05 ZM 227.98 945.52 C230.87,946.45 235.57,946.87 241.02,946.69 C248.09,946.45 250.66,945.88 256.20,943.29 C275.67,934.18 283.31,915.33 272.73,902.49 C267.83,896.55 261.24,894.02 250.57,894.01 C242.20,894.00 241.13,894.25 233.44,897.97 C220.24,904.36 212.95,914.34 213.02,925.93 C213.07,933.95 219.93,942.94 227.98,945.52 Z"/>
              </g>
            </svg>
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#111111' }}>Six Spur Ranch and Rescue</span>
            </div>
            <p style={{ color: '#666666', fontSize: '12px', lineHeight: '1.65' }}>
              A 501(c)(3) nonprofit animal rescue and sanctuary in Texas.
            </p>
            <p style={{ color: '#999999', fontSize: '11px', marginTop: '8px' }}>EIN: 41-4123317</p>
          </div>

          {/* Adopt */}
          <div>
            <h4 style={{ color: '#111111', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Adopt</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/adopt'         style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Adoptable dogs</Link>
              <Link href='/adopt/recent'  style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Recently adopted</Link>
              <Link href='/adopt/process' style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Adoption process</Link>
              <Link href='/faq'           style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>FAQ</Link>
            </div>
          </div>

          {/* Give */}
          <div>
            <h4 style={{ color: '#111111', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Give</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/donate'         style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Donate</Link>
              <Link href='/give#monthly'   style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Monthly giving</Link>
              <Link href='/give#wishlists' style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Wish lists</Link>
              
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 style={{ color: '#111111', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Shop</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/shop#hats'        style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Hats</Link>
              <Link href='/shop#tees'        style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Tees</Link>
              <Link href='/shop#hoodies'     style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Hoodies</Link>
              <Link href='/shop#accessories' style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Accessories</Link>
            </div>
          </div>

          {/* Ranch */}
          <div>
            <h4 style={{ color: '#111111', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Ranch</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link href='/about'   style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Our story</Link>
              <Link href='/farm'    style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>The farm family</Link>
              <Link href='/news'    style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>News and updates</Link>
              <Link href='/contact' style={{ color: '#666666', fontSize: '12px', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')} onMouseLeave={(e) => (e.currentTarget.style.color = '#666666')}>Contact</Link>
            </div>
          </div>

        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '1.5rem' }}>
          <div>
            <p style={{ color: '#888888', fontSize: '11px' }}>© {new Date().getFullYear()} Six Spur Ranch and Rescue. All rights reserved.</p>
            <p style={{ color: '#999999', fontSize: '11px', marginTop: '4px' }}>Six Spur Ranch and Rescue is a registered 501(c)(3). Your contribution is tax-deductible to the extent allowed by law.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a href='https://facebook.com' target='_blank' rel='noreferrer' aria-label='Facebook'
              style={{ color: '#888888', display: 'flex', transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
            <a href='https://instagram.com' target='_blank' rel='noreferrer' aria-label='Instagram'
              style={{ color: '#888888', display: 'flex', transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </a>
            <a href='https://tiktok.com' target='_blank' rel='noreferrer' aria-label='TikTok'
              style={{ color: '#888888', display: 'flex', transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
              </svg>
            </a>
            <a href='https://youtube.com' target='_blank' rel='noreferrer' aria-label='YouTube'
              style={{ color: '#888888', display: 'flex', transition: 'color 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#E77A2D')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
              </svg>
            </a>
          </div>
        </div>

      </div>
    </footer>
  )
}
