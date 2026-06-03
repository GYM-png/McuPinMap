import type { PackageLayout } from "../../shared/types";
import { BgaPackageMap } from "./BgaPackageMap";
import { LqfpPackageMap } from "./LqfpPackageMap";

type PackageMapProps = {
  layout: PackageLayout;
};

export const PackageMap = ({ layout }: PackageMapProps): JSX.Element => {
  if (layout.packageType === "BGA") {
    return <BgaPackageMap layout={layout} />;
  }

  return <LqfpPackageMap layout={layout} />;
};
