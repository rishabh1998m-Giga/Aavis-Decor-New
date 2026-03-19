import { Helmet } from "react-helmet-async";

interface PageMetaProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any>;
}

const SITE_NAME = "Aavis Decor";
const DEFAULT_DESCRIPTION = "Premium handcrafted home textiles — pillow covers, curtains, table cloths & more. Quality fabrics, elegant designs, delivered across India.";
const DEFAULT_OG_IMAGE = "/placeholder.svg";

const getAbsoluteUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
};

const PageMeta = ({ title, description, canonical, ogImage, ogType = "website", noIndex = false, jsonLd }: PageMetaProps) => {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const desc = description || DEFAULT_DESCRIPTION;
  const image = getAbsoluteUrl(ogImage || DEFAULT_OG_IMAGE);
  const canonicalUrl = canonical ? getAbsoluteUrl(canonical) : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={image} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default PageMeta;
