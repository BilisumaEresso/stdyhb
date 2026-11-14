import React from "react";
import {
  BookOpen,
  BookHeart,
  FileCheck2,
  GraduationCap,
  Languages,
  Calculator,
  FlaskConical,
  Compass,
  Landmark,
  Laptop,
  Palette,
  BookMarked,
  Divide,
  Atom,
  Beaker,
  Dna,
  Globe,
  Cpu,
  Code,
  Wrench,
  Activity,
  Sprout,
  TrendingUp,
  Scale,
  type LucideProps,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  BookOpen,
  BookHeart,
  FileCheck2,
  GraduationCap,
  Languages,
  Calculator,
  FlaskConical,
  Compass,
  Landmark,
  Laptop,
  Palette,
  BookMarked,
  Divide,
  Atom,
  Beaker,
  Dna,
  Globe,
  Cpu,
  Code,
  Wrench,
  Activity,
  Sprout,
  TrendingUp,
  Scale,
};

interface TaxonomyIconProps extends LucideProps {
  name?: string;
}

export default function TaxonomyIcon({ name, ...props }: TaxonomyIconProps) {
  const IconComponent = (name && ICON_MAP[name]) ? ICON_MAP[name] : BookOpen;
  return <IconComponent {...props} />;
}
