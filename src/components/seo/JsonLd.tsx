/**
 * JSON-LD Structured Data Components
 * ───────────────────────────────────
 * Google Rich Results uchun tuzilgan ma'lumotlar
 */

interface OrganizationLdProps {
    name?: string;
    url?: string;
    logo?: string;
    phone?: string;
    address?: {
        street: string;
        city: string;
        region: string;
        country: string;
        postalCode?: string;
    };
}

export function OrganizationLd({
    name = 'Pack24',
    url = 'https://pack24.uz',
    logo = 'https://pack24.uz/logo.png',
    phone = '+998 71 200 24 24',
    address = {
        street: 'Chilonzor tumani, 19-mavze',
        city: 'Toshkent',
        region: 'Toshkent shahri',
        country: 'UZ',
    },
}: OrganizationLdProps) {
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name,
        url,
        logo,
        contactPoint: {
            '@type': 'ContactPoint',
            telephone: phone,
            contactType: 'customer service',
            availableLanguage: ['uz', 'ru', 'en'],
        },
        address: {
            '@type': 'PostalAddress',
            streetAddress: address.street,
            addressLocality: address.city,
            addressRegion: address.region,
            addressCountry: address.country,
            ...(address.postalCode ? { postalCode: address.postalCode } : {}),
        },
        sameAs: [
            'https://t.me/pack24uz',
            'https://instagram.com/pack24.uz',
        ],
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
    );
}

export function WebSiteLd({
    name = 'Pack24',
    url = 'https://pack24.uz',
}: { name?: string; url?: string }) {
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name,
        url,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${url}/catalog?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
    );
}

export function ProductLd({
    name,
    description,
    image,
    price,
    currency = 'UZS',
    sku,
    inStock,
    url,
}: {
    name: string;
    description?: string;
    image: string;
    price: number;
    currency?: string;
    sku?: string;
    inStock: boolean;
    url: string;
}) {
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        description,
        image,
        sku,
        url,
        offers: {
            '@type': 'Offer',
            price: price.toString(),
            priceCurrency: currency,
            availability: inStock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            seller: {
                '@type': 'Organization',
                name: 'Pack24',
            },
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
    );
}

export function BreadcrumbLd({
    items,
}: {
    items: { name: string; url: string }[];
}) {
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: item.url,
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
    );
}

export function FAQPageLd({
    questions,
}: {
    questions: { question: string; answer: string }[];
}) {
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions.map((q) => ({
            '@type': 'Question',
            name: q.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: q.answer,
            },
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
    );
}
