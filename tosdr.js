const TermsLensToSDr = (() => {
  const API_ORIGIN = 'https://api.tosdr.org';

  async function request(path) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`ToS;DR API returned ${response.status}.`);
    return response.json();
  }

  function serviceMatchesHost(service, hostname) {
    const host = hostname.toLowerCase().replace(/^www\./, '');
    return (service.urls || []).some((url) => {
      try {
        return new URL(url.includes('://') ? url : `https://${url}`).hostname.replace(/^www\./, '').endsWith(host);
      } catch (error) {
        return url.toLowerCase().replace(/^www\./, '').endsWith(host);
      }
    });
  }

  async function lookup(hostname) {
    const search = await request(`/search/v5?query=${encodeURIComponent(hostname)}`);
    const services = Array.isArray(search.services) ? search.services : [];
    const service = services.find((candidate) => serviceMatchesHost(candidate, hostname)) || services[0];
    if (!service?.id) return null;

    const details = await request(`/service/v3?id=${encodeURIComponent(service.id)}`);
    const points = Array.isArray(details.points) ? details.points : [];
    const documents = Array.isArray(details.documents) ? details.documents : [];
    return {
      id: details.id,
      name: details.name || service.name,
      slug: details.slug || service.slug,
      rating: details.rating || service.rating || 'N/A',
      reviewed: Boolean(details.is_comprehensively_reviewed ?? service.is_comprehensively_reviewed),
      points: points.filter((point) => point.status === 'approved').slice(0, 5).map((point) => ({
        title: point.title,
        status: point.status,
        caseTitle: point.case?.title || null,
        caseImpact: point.case?.impact || null
      })),
      documents: documents.slice(0, 3).map((document) => ({ name: document.name, url: document.url })),
      sourceUrl: `https://tosdr.org/en/service/${details.slug || service.slug}`
    };
  }

  return { lookup };
})();
