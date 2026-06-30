import Hero from '@/components/sections/Hero';
import Mission from '@/components/sections/Mission';
import AdoptableAnimals from '@/components/sections/AdoptableAnimals';
import FarmFamily from '@/components/sections/FarmFamily';
import Team from '@/components/sections/Team';
import WaysToGive from '@/components/sections/WaysToGive';
import ShopPreview from '@/components/sections/ShopPreview';
import NewsGrid from '@/components/sections/NewsGrid';
import Newsletter from '@/components/sections/Newsletter';

export default function Home() {
  return (
    <main>
      <Hero />
      <Mission />
      <AdoptableAnimals />
      <FarmFamily />
      <Team />
      <WaysToGive />
      <ShopPreview />
      <NewsGrid />
      <Newsletter />
    </main>
  );
}
