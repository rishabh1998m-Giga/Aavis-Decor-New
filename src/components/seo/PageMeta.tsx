import { Helmet } from "react-helmet-async";

interface PageMetaProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, any>;
}

const SITE_NAME = "Cushy Crafts";
const DEFAULT_DESCRIPTION = "Premium handcrafted home textiles — pillow covers, curtains, table cloths & more. Quality fabrics, elegant designs, delivered across India.";
const DEFAULT_OG_IMAGE = "/placeholder.svg";

const PageMeta = ({ title, description, canonical, ogImage, ogType = "website", jsonLd }: PageMetaProps) => {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const desc = description || DEFAULT_DESCRIPTION;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={ogType} />
      {ogImage && <meta property="og:image" content={ogImage || DEFAULT_OG_IMAGE} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default PageMeta;
